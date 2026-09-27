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

// Rules that apply across layers, so they live in their own plugin instead of fighting over no-restricted-imports.
const ferry = {
  rules: {
    "no-direct-anthropic": {
      meta: { type: "problem", schema: [], messages: { direct: "@anthropic-ai/* is allowed only in src/lib/ai.ts and src/server/integrations/llm (the direct API is synthetic-only)." } },
      create(context) {
        const check = (node, source) => {
          if (typeof source === "string" && /^@anthropic-ai\//.test(source)) context.report({ node, messageId: "direct" });
        };
        return {
          ImportDeclaration: (n) => check(n, n.source.value),
          ExportNamedDeclaration: (n) => n.source && check(n, n.source.value),
          ExportAllDeclaration: (n) => check(n, n.source.value),
          ImportExpression: (n) => n.source.type === "Literal" && check(n, n.source.value),
          CallExpression: (n) => n.callee.type === "Identifier" && n.callee.name === "require" && n.arguments[0]?.type === "Literal" && check(n, n.arguments[0].value),
        };
      },
    },
    "no-phi-cache": {
      meta: { type: "problem", schema: [], messages: { cache: "Caching is banned on PHI paths: no 'use cache', unstable_cache or cacheLife here." } },
      create(context) {
        return {
          ExpressionStatement: (n) => typeof n.directive === "string" && n.directive.startsWith("use cache") && context.report({ node: n, messageId: "cache" }),
          Identifier: (n) => (n.name === "unstable_cache" || n.name === "cacheLife") && context.report({ node: n, messageId: "cache" }),
        };
      },
    },
  },
};

const crossCutting = [
  { plugins: { ferry } },
  { files: ["**/*.{ts,tsx,mts,js,mjs}"], ignores: ["src/lib/ai.ts", "src/server/integrations/llm/**"], rules: { "ferry/no-direct-anthropic": "error" } },
  { files: ["src/**"], ignores: ["src/app/(public)/**"], rules: { "ferry/no-phi-cache": "error" } },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  ...crossCutting,
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
