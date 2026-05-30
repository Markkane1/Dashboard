import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "mongoose",
              message: "Next.js code must not access MongoDB directly. Call the Express API instead.",
            },
          ],
          patterns: [
            {
              group: [
                "@/server",
                "@/server/*",
                "@/server/**",
                "src/server",
                "src/server/*",
                "src/server/**",
                "../server",
                "../server/*",
                "../server/**",
                "../../server",
                "../../server/*",
                "../../server/**",
              ],
              message: "Next.js code must not import Express server internals. Use an infrastructure API client.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  {
    ignores: [
      // Default ignores of eslint-config-next:
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
