import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
export default defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ["**/*.tsx", "**/*.ts"],
    plugins: { "react-hooks": hooks, "jsx-a11y": a11y },
    rules: { ...hooks.configs.recommended.rules, ...a11y.configs.recommended.rules },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    ".private/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
