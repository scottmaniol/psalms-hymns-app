import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      publicDir: 'public',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      preview: {
        // Add the specific deployment URL to prevent "Blocked request" errors.
        // The wildcard '.run.app' is kept for broader compatibility.
        allowedHosts: [
          'classichymns.org', 
          '.run.app',
          'psalms-hymns-to-the-living-god-812173112142.us-west1.run.app',
        ],
        port: 8080,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
