import express from 'express';
import { AgentCard } from '../../index.js';
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from '../../server/index.js';
import { jsonRpcHandler } from '../../server/express/index.js';
import { traceGate } from './trace_middleware.js';

// Dummy agent executor for the sample
class TraceAgentExecutor implements AgentExecutor {
  async executeTask(task: any) {
    return {
      status: 'completed',
      result: 'Task executed securely after passing TRACE trust gate!',
    };
  }
}

// --- Server Setup ---

const traceAgentCard: AgentCard = {
  name: 'TRACE Secured Data Agent',
  description: 'An agent protected by the TRACE Sybil-resistant trust layer.',
  url: 'http://localhost:41242/',
  provider: {
    organization: 'TRACE Protocol',
    url: 'https://trace.dev',
  },
  version: '1.0.0',
  protocolVersion: '0.3.0',
  capabilities: {
    stateTransitionHistory: true,
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'task-status'],
  skills: [
    {
      id: 'secure_data_analysis',
      name: 'Secure Data Analysis',
      description: 'Run analysis, gated by TRACE trust score.',
      tags: ['data', 'secure'],
      examples: ['Analyze the dataset'],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new TraceAgentExecutor();

  const requestHandler = new DefaultRequestHandler(
    traceAgentCard,
    taskStore,
    agentExecutor
  );

  const app = express();
  app.use(express.json());

  // Use the TRACE middleware to gate all incoming A2A requests
  app.use(traceGate({ apiKey: 'sk_test_trace_123', minScore: 0.25 }));

  app.use(
    jsonRpcHandler({
      requestHandler,
      userBuilder: async (req) => { return { id: req.headers["x-agent-wallet"] || "anonymous" } }
    })
  );

  const PORT = process.env.PORT || 41242;
  app.listen(PORT, (err: unknown) => {
    if (err) throw err;
    console.log(`[TraceAgent] Server started on http://localhost:${PORT}`);
    console.log(
      `[TraceAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`
    );
    console.log('[TraceAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);
