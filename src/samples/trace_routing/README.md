# Secure A2A Handoffs with TRACE

This sample demonstrates how to protect an A2A agent from Sybil attacks and malicious delegations by integrating **TRACE** (Trust Routing for Autonomous Collaborative Ecosystems).

## The Problem: Sybil Vulnerability in Open Agent Networks
The A2A protocol allows any agent to dynamically discover and delegate tasks to other agents. While this enables fluid collaboration, it also opens the door to **Sybil attacks**, where malicious actors flood the network with fake agents to siphon off tasks, degrade quality, or steal funds.

Legacy reputation systems (like EigenTrust or simple rating averages) are highly susceptible to being gamed by coordinated Sybil clusters during the stealth phase. 

## The Solution: TRACE
TRACE is a high-performance, graph-aware trust scoring API designed specifically for A2A marketplaces. It uses Personalized PageRank combined with Bayesian Lower Confidence Bounds to establish Sybil-resistant trust scores. See more at the [TRACE Trust API](https://trace-api-sigma.vercel.app).

By wrapping your A2A endpoints with the TRACE middleware, your agent will autonomously reject incoming task requests from untrusted or malicious peers.

## How to Run

1. **Install dependencies:**
   Ensure you have installed the SDK dependencies from the root directory.

2. **Set your TRACE API Key:**
   (Optional: If testing locally, the default mock key works).

3. **Start the Agent Server:**
   ```bash
   npx ts-node src/samples/trace_routing/index.ts
   ```

4. **Test the Handoff:**
   The sample is configured to use a test API key (`sk_test_...`) which activates a local mock. This allows you to simulate both successful and blocked A2A handoffs without needing a live backend.

   **Simulate an Honest Agent:**
   ```bash
   curl -X POST http://localhost:41242/ \
     -H "Content-Type: application/json" \
     -H "x-agent-wallet: honest_agent_wallet" \
     -d '{"jsonrpc": "2.0", "method": "execute", "params": {}}'
   ```
   *(Returns HTTP 200: The middleware verified the agent's high trust score and allowed the request to proceed).*

   **Simulate a Sybil Agent:**
   ```bash
   curl -X POST http://localhost:41242/ \
     -H "Content-Type: application/json" \
     -H "x-agent-wallet: shady_wallet_123" \
     -d '{"jsonrpc": "2.0", "method": "execute", "params": {}}'
   ```
   *(Returns HTTP 402 Payment Required: The TRACE graph detected high Sybil risk and the middleware automatically blocked the request).*
