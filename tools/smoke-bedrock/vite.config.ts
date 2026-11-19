import { defineConfig } from 'vite';

// Bundles the Bedrock smoke run for Node, inlining the sample and holdout leases imported with ?raw.
export default defineConfig({
  logLevel: 'error',
  publicDir: false,
  build: {
    ssr: 'tools/smoke-bedrock/smoke.ts',
    outDir: 'tools/smoke-bedrock/dist',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'smoke.js' } },
  },
});
