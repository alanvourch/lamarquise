import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lets the same build run at the root (Vercel) or under /<repo>/ (GitHub Pages).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
});
