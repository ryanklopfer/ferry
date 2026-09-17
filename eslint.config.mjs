import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layering, enforced. See docs/architecture.md §3 and src/boundaries.test.ts.
const boundaries = [
  {
    // Pure domain: zod, date-fns, relative imports and @/core only.
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: "^(?!(zod|date-fns)(/|$)|\\.{1,2}/|@/core/)", message: "src/core is pure: it may import only zod, date-fns and other src/core modules." }] }],
    },
  },
  {
    // UI reads and writes through services, never the database.
    files: ["src/app/**", "src/ui/**", "src/components/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["drizzle-orm", "drizzle-orm/*", "pg", "@/server/db", "@/server/db/**"], message: "UI code goes through @/server/services, not the database." }] }],
    },
  },
  {
    // Services compose repos; only repos hold the database handle.
    files: ["src/server/services/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "@/server/db", message: "Services use repos in @/server/db/repos, not the database handle." }, { name: "drizzle-orm", message: "Queries belong in a repo." }, { name: "pg", message: "Queries belong in a repo." }] }],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  // Tests may reach across layers to set up and inspect state.
  { files: ["**/*.test.ts"], rules: { "no-restricted-imports": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
