import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run test files sequentially to avoid toolchain singleton conflicts
    fileParallelism: false,
    env: {
      AWS_PROFILE: "aws-3",
    },
  },
});