module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // We don't care about the coverage of the generated js in dist/
  // Also ignore mocks because... well... they're mocks.
  collectCoverageFrom: [
    "encode-video/**/{!(mock*),}.ts",
    "common/**/{!(mock*),}.ts",
    // Ignore types definitions
    "!**/*.d.ts",
  ],
};
