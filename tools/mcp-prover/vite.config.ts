import { defineConfig } from 'vite';

// Bundles the MCP server for Node, inlining the Prolog sources and sample leases the app imports with ?raw.
export default defineConfig({
  logLevel: 'error',
  publicDir: false,
  build: {
    ssr: 'tools/mcp-prover/server.ts',
    outDir: 'tools/mcp-prover/dist',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'server.js' } },
  },
});
