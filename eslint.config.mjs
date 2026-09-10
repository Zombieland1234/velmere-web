import eslintJs from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@next/next/no-img-element": "warn",
      // React 19/Compiler diagnostics enter as migration warnings.
      // TypeScript and production builds remain hard release gates.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      // A leading underscore is the repository-wide explicit marker for an
      // intentionally unused binding. Ordinary names remain fully reported.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      "@typescript-eslint/no-unused-expressions": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs,ts}"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,cjs}"],
    rules: {
      // Historical and diagnostic gates are Node CommonJS wrappers by design.
      // Product runtime remains ESM/Next and is linted under the strict rules above.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "artifacts/**",
    "archive/**",
    ".velmere/**",
    "next-env.d.ts",
  ]),
]);
