import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'dist/',
        'example/',
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/index.ts',
        '**/types.ts'
      ]
    }
  }
}); 