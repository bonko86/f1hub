import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react()], root: 'client', build: { outDir: '../dist/client', emptyOutDir: true }, server: { port: Number(process.env.VITE_PORT || env.VITE_PORT || 5180), strictPort: true, proxy: { '/api': `http://localhost:${process.env.PORT || env.PORT || 3000}` } } };
});
