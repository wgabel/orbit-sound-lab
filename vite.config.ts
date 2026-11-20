import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/orbit-sound-lab/',
  plugins: [react()],
  resolve: {
    alias: {
      '@application': '/src/application',
      '@composition': '/src/composition',
      '@domain': '/src/domain',
      '@infrastructure': '/src/infrastructure',
      '@presentation': '/src/presentation'
    }
  },
  test: { environment: 'node' }
});
