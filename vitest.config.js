import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/ui/render.js'],
      thresholds: { lines: 95, functions: 95, branches: 85, statements: 95 },
      reporter: ['text', 'html'],
    },
  },
});
