module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/security/**/*.test.js'
  ],
  setupFilesAfterEnv: [],
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

