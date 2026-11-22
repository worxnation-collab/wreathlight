import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["node_modules/", "dist/", ".wrangler/", ".cache/", "coverage/", "playwright-report/", "test-results/", "content/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      // The app uses `any` at JSON/API boundaries (D1 rows, fetch bodies, Hono context). Kept visible as
      // warnings so they can be narrowed over time, without blocking CI during the hackathon week.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["src/client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
