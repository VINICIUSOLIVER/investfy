import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// CSP só no build de produção: em dev o React Fast Refresh precisa de script inline
const productionCsp = () => ({
  name: 'production-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content:
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:",
      },
      injectTo: 'head',
    },
  ],
});

export default defineConfig({
  plugins: [react(), tailwindcss(), productionCsp()],
  // Caminhos relativos para que o build funcione via file:// dentro do Electron
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
