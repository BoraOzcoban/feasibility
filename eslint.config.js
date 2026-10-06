import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/", "node_modules/", "supabase/functions/", "playwright-report/", "test-results/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.mjs", "*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
      sourceType: "module",
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      // Catches identifiers that lost their import or definition.
      "no-undef": "error",
      "react/jsx-no-undef": "error",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
    },
    settings: { react: { version: "detect" } },
  },
  {
    // Browser tests: Node code that also hands functions to the page to run.
    files: ["e2e/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.browser, ...globals.node },
      sourceType: "module",
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
    },
  },
  {
    // Values copied verbatim from the Excel regression workbook.
    files: ["src/lib/costEngineRegressionFixture.js"],
    rules: { "no-loss-of-precision": "off" },
  },
];
