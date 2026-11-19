// A stdio MCP server that exposes the Lease Lawyer prover to a coding agent, so the agent can
// check a rule-base change against real leases while it edits. Build and run: npm run mcp:prover
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { callTool, TOOLS } from './tools';

export function createProverServer(): Server {
  const server = new Server({ name: 'lease-lawyer-prover', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await callTool(request.params.name, request.params.arguments ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true };
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  await createProverServer().connect(new StdioServerTransport());
}
