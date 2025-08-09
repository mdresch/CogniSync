module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  rootDir: '..',
  globals: {
    'ts-jest': {
      tsconfig: 'tests/tsconfig.json'
    }
  }
};
