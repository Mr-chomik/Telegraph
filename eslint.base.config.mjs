import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "generated/**", ".next/**", "node_modules/**", "**/*.config.*"],
  },
  ...tseslint.configs.recommended,
);