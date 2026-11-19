import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3160, strictPort: true },
  preview: { port: 3161, strictPort: true },
});
