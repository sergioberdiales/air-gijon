import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000'
        : 'https://air-gijon-backend.onrender.com'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
});
