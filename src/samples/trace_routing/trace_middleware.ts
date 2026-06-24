/**
 * TRACE API — TypeScript x402 middleware
 *
 * Drop-in for any Express / Hono / Node.js x402 server.
 * Checks agent trust score before processing payment.
 */

const TRACE_API_URL = "https://api.trace.dev";

interface TraceScoreResult {
  provider_id: string;
  score: number;
  routing_decision: "ROUTE" | "ROUTE_WITH_CAUTION" | "HOLD" | "INVESTIGATE";
  components: {
    lcb: number;
    default_risk: number;
    cost_norm: number;
    trust_net: number;
    cap_match: number;
    sybil_risk: number;
    clique_penalty: number;
  };
  flags: string[];
  explanation: string;
  latency_ms: number;
  version: string;
}

interface TRACEMiddlewareOptions {
  apiKey: string;
  minScore?: number;
  apiUrl?: string;
}

export class TRACEMiddleware {
  private apiKey: string;
  private minScore: number;
  private apiUrl: string;

  constructor(options: TRACEMiddlewareOptions) {
    this.apiKey = options.apiKey;
    this.minScore = options.minScore ?? 0.35;
    this.apiUrl = options.apiUrl ?? TRACE_API_URL;
  }

  /**
   * Call before processing x402 payment.
   * Returns score result or throws an error with status 402 if agent is untrusted.
   */
  async check(
    agentWallet: string,
    jobCapability: string,
    priceUsdc: number
  ): Promise<TraceScoreResult> {
    let result: TraceScoreResult;

    // ─── MOCK MODE FOR SDK SAMPLES ─────────────────────────────────────────
    if (this.apiKey.startsWith("sk_test_")) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (agentWallet === "honest_agent_wallet") {
        result = {
          provider_id: agentWallet,
          score: 0.95,
          routing_decision: "ROUTE",
          components: { lcb: 0.92, default_risk: 0.01, cost_norm: 0.5, trust_net: 0.95, cap_match: 1.0, sybil_risk: 0.0, clique_penalty: 0.0 },
          flags: [],
          explanation: "Agent is highly trusted in the global TRACE graph.",
          latency_ms: 300,
          version: "1.0-mock",
        };
      } else {
        result = {
          provider_id: agentWallet,
          score: 0.12,
          routing_decision: "HOLD",
          components: { lcb: 0.10, default_risk: 0.5, cost_norm: 0.5, trust_net: 0.12, cap_match: 1.0, sybil_risk: 0.88, clique_penalty: 0.75 },
          flags: ["HIGH_SYBIL_RISK", "NEW_AGENT"],
          explanation: "Agent lacks sufficient inbound trust edges and exhibits Sybil-like clustering.",
          latency_ms: 300,
          version: "1.0-mock",
        };
      }
    } else {
      // ───────────────────────────────────────────────────────────────────────
      const resp = await fetch(`${this.apiUrl}/v1/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify({
          provider_id: agentWallet,
          job: {
            capability: jobCapability,
            price_usdc: priceUsdc,
          },
          provider_history: {},
          graph_context: {},
        }),
        signal: AbortSignal.timeout(5000),
      });
      result = await resp.json();
    }

    if (
      result.routing_decision === "HOLD" ||
      result.routing_decision === "INVESTIGATE"
    ) {
      const error = new Error(
        `Agent trust score ${result.score.toFixed(2)} below threshold ${this.minScore}`
      );
      (error as any).status = 402;
      (error as any).details = {
        error: "agent_untrusted",
        score: result.score,
        flags: result.flags,
      };
      throw error;
    }

    return result;
  }
}

/**
 * Express middleware factory.
 *
 * Usage:
 *   import { traceGate } from "./x402_middleware";
 *   app.use("/agent", traceGate({ apiKey: "sk_trace_..." }));
 */
export function traceGate(options: TRACEMiddlewareOptions) {
  const trace = new TRACEMiddleware(options);

  return async (req: any, res: any, next: any) => {
    const agentWallet =
      req.headers["x-payment-sender"] || req.headers["x-agent-wallet"];
    const capability = req.body?.capability ?? "default";
    const price = req.body?.price_usdc ?? 0.01;

    if (!agentWallet) {
      return next(); // No wallet header — skip trust check
    }

    try {
      const result = await trace.check(agentWallet, capability, price);
      req.traceScore = result;
      next();
    } catch (err: any) {
      res.status(err.status || 402).json({
        error: "agent_untrusted",
        score: err.details?.score,
        flags: err.details?.flags,
        message: err.message,
      });
    }
  };
}
