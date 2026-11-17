/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tests always use the demo backend, never the live database from .env.local.
  test: {
    globals: true, environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], testTimeout: 15000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
