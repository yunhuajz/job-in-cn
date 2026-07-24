import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // P0 骨架阶段尚无测试文件,允许空跑通过
    passWithNoTests: true,
    include: ['tests/**/*.test.ts'],
  },
});
