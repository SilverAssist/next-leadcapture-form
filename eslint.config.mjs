import { ESLINT_IGNORE_PATTERNS } from "@silverassist/next-testing-toolkit";
import react from "@silverassist/npm-package-standards/eslint/react";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...react,
  {
    files: ["**/__tests__/**", "jest.setup.js", "jest.config.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: [...ESLINT_IGNORE_PATTERNS, "coverage/**"],
  },
);
