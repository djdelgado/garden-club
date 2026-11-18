import nextJest from "next/jest.js";

// next/jest wires SWC transforms, CSS/image mocks, and .env loading so tests
// compile the same way the app does.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Mirror the tsconfig "@/*" path alias.
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}"],
  // The static export and build output are never test sources.
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/out/", "<rootDir>/node_modules/"],
};

export default createJestConfig(config);
