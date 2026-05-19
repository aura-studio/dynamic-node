const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run test files sequentially to avoid singleton conflicts
    fileParallelism: false,
    env: {
      AWS_PROFILE: "aws-3",
    },
  },
});
