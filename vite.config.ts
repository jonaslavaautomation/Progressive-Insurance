import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Link-preview crawlers need an absolute og:image URL. On Vercel the production domain is
// provided at build time; SITE_URL can override it (e.g. a custom domain).
function siteUrl(): Plugin {
  const host = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return { name: 'site-url', transformIndexHtml: (html) => html.split('%SITE_URL%').join(host.replace(/\/$/, '')) };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), siteUrl()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
