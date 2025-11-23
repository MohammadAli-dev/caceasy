module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    forceExit: true,
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};
