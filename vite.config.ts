import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    root: 'src/client',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src/client'),
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:8787',
                changeOrigin: true,
            },
        },
    },
});
