import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// The dev server proxies the API paths to the services, so the browser sees a single origin (no CORS).
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        proxy: {
            '/api/auth': { target: 'http://localhost:4000' },
            '/api/data': { target: 'http://localhost:4100' },
            '/ml': { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/ml/, '') },
        },
    },
});