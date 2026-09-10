import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Which portal this build is. Sent as X-Portal on every API call so
  // the session cookie is namespaced per portal — cookies ignore the
  // port, so without this all four portals share one session slot.
  define: { 'import.meta.env.VITE_PORTAL': JSON.stringify('agent') },
  server: { port: 5175, strictPort: true },
});
