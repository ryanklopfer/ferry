import path from "node:path";
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

const SRC = path.join(import.meta.dirname, "src");

// "@/server/x" for both alias and relative specifiers, so one pattern covers either spelling.
const toAlias = (filename, source) => (source.startsWith(".") ? `@/${path.relative(SRC, path.resolve(path.dirname(filename), source)).split(path.sep).join("/")}` : source);

// Walks every way a module can be pulled in: import, re-export, dynamic import, require.
const importVisitors = (check) => ({
  ImportDeclaration: (n) => check(n, n.source.value),
  ExportNamedDeclaration: (n) => n.source && check(n, n.source.value),
  ExportAllDeclaration: (n) => check(n, n.source.value),
  ImportExpression: (n) => check(n, n.source.type === "Literal" ? n.source.value : null),
  CallExpression: (n) => n.callee.type === "Identifier" && n.callee.name === "require" && check(n, n.arguments[0]?.type === "Literal" ? n.arguments[0].value : null),
});

const SYSTEM_CTX_ALLOWED = /^src\/(server\/(jobs|relay)\/|app\/api\/webhooks\/|server\/services\/ops\.ts$|server\/auth\/system-ctx\.ts$)/;
const INVITE_CTX_ALLOWED = /^src\/server\/services\/invites\.ts$/;
// Only the auth module, the invite service and the test helper assemble a context by hand; everything else gets one from a guard or constructor.
const CTX_LITERAL_ALLOWED = /^src\/(server\/auth\/|server\/services\/invites\.ts$|server\/db\/testing\.ts$)/;
const CTX_SCOPES = new Set(["clinician", "self", "client", "invite", "system", "staff"]);
const CTX_TYPES = new Set(["ClinicianCtx", "SelfCtx", "ClientCtx", "InviteCtx", "SystemCtx", "StaffCtx", "Ctx", "ClinicianOnlyCtx"]);

// Modules that change roles or mint test users, and the only files that may import them (tests are exempt via config).
const PRIVILEGED_MODULES = [
  { module: "@/server/services/roles", allowed: /^(scripts\/ops\/|src\/server\/services\/(invites|clinician)\.ts$)/, message: "Roles are set only by staff:grant (scripts/ops), acceptInvite (services/invites.ts) and Start free (services/clinician.ts)." },
  { module: "@/server/db/repos/users", allowed: /^src\/server\/services\/(roles|invites)\.ts$/, message: "The users repo changes roles; only services/roles.ts and services/invites.ts may use it." },
  { module: "@/server/db/testing", allowed: /^$/, message: "@/server/db/testing creates users with any role; only tests may import it." },
];

// Rules that apply across layers, so they live in their own plugin instead of fighting over no-restricted-imports.
const ferry = {
  rules: {
    "no-direct-anthropic": {
      meta: { type: "problem", schema: [], messages: { direct: "@anthropic-ai/* is allowed only in src/server/integrations/llm (the direct API is synthetic-only)." } },
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
    "no-capture-persistence": {
      meta: { type: "problem", schema: [], messages: { persist: "Capture code never writes audio or text to disk, storage or the database: no fs, @/server/storage, @/server/db or Bun file APIs. Persist only through @/server/services with a SystemCtx." } },
      create(context) {
        const banned = (source) => {
          if (typeof source !== "string") return false;
          const target = toAlias(context.filename, source);
          return /^(node:)?fs(\/|$)|^bun:sqlite$|^@\/server\/(storage|db)(\/|$)/.test(target);
        };
        const check = (node, source) => banned(source) && context.report({ node, messageId: "persist" });
        return {
          ImportDeclaration: (n) => check(n, n.source.value),
          ExportNamedDeclaration: (n) => n.source && check(n, n.source.value),
          ExportAllDeclaration: (n) => check(n, n.source.value),
          ImportExpression: (n) => (n.source.type === "Literal" ? check(n, n.source.value) : context.report({ node: n, messageId: "persist" })),
          CallExpression: (n) => n.callee.type === "Identifier" && n.callee.name === "require" && (n.arguments[0]?.type === "Literal" ? check(n, n.arguments[0].value) : context.report({ node: n, messageId: "persist" })),
          // Bun.write and Bun.file reach the disk without an import; the relay has no other use for Bun.
          Identifier: (n) => n.name === "Bun" && context.report({ node: n, messageId: "persist" }),
        };
      },
    },
    "ctx-constructors": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          system: "systemCtx() is usable only in src/server/jobs, src/server/relay, src/app/api/webhooks and src/server/services/ops.ts.",
          invite: "inviteCtx() is usable only inside src/server/services/invites.ts.",
          literal: "Build a context only through a guard (requireClinician, getClinician, ...) or its constructor, never as an object literal or a cast.",
        },
      },
      create(context) {
        const file = path.relative(import.meta.dirname, context.filename).split(path.sep).join("/");
        const systemOk = SYSTEM_CTX_ALLOWED.test(file);
        const inviteOk = INVITE_CTX_ALLOWED.test(file);
        const literalOk = CTX_LITERAL_ALLOWED.test(file);
        const scopeValue = (v) => (v.type === "Literal" ? v.value : v.type === "TemplateLiteral" && v.expressions.length === 0 ? v.quasis[0].value.cooked : null);
        const isCtxType = (t) => t?.type === "TSTypeReference" && t.typeName.type === "Identifier" && CTX_TYPES.has(t.typeName.name);
        const seen = new Set();
        const report = (node, messageId) => {
          const key = `${messageId}:${node.range[0]}`;
          if (seen.has(key)) return;
          seen.add(key);
          context.report({ node, messageId });
        };
        return {
          ...importVisitors((node, source) => !systemOk && typeof source === "string" && toAlias(context.filename, source) === "@/server/auth/system-ctx" && report(node, "system")),
          // The names themselves are reserved, so a namespace import, a re-export or an alias can't slip past.
          Identifier: (n) => {
            if (n.name === "systemCtx" && !systemOk) report(n, "system");
            if (n.name === "inviteCtx" && !inviteOk) report(n, "invite");
          },
          Property: (n) => {
            const key = n.key.type === "Identifier" && !n.computed ? n.key.name : n.key.type === "Literal" ? n.key.value : null;
            if (!literalOk && n.parent.type === "ObjectExpression" && key === "scope" && CTX_SCOPES.has(scopeValue(n.value))) report(n, "literal");
          },
          TSAsExpression: (n) => !literalOk && isCtxType(n.typeAnnotation) && report(n, "literal"),
          TSTypeAssertion: (n) => !literalOk && isCtxType(n.typeAnnotation) && report(n, "literal"),
        };
      },
    },
    "privileged-imports": {
      meta: { type: "problem", schema: [], messages: { restricted: "{{message}}" } },
      create(context) {
        const file = path.relative(import.meta.dirname, context.filename).split(path.sep).join("/");
        return importVisitors((node, source) => {
          if (typeof source !== "string") return;
          const target = toAlias(context.filename, source);
          const hit = PRIVILEGED_MODULES.find((m) => m.module === target && !m.allowed.test(file));
          if (hit) context.report({ node, messageId: "restricted", data: { message: hit.message } });
        });
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
  { files: ["**/*.{ts,tsx,mts,js,mjs}"], ignores: ["src/server/integrations/llm/**"], rules: { "ferry/no-direct-anthropic": "error" } },
  { files: ["src/**"], ignores: ["src/app/(public)/**"], rules: { "ferry/no-phi-cache": "error" } },
  // Contexts that act for a tenant without a signed-in clinician are built only where the plan allows (architecture §6).
  { files: ["src/**", "scripts/**"], ignores: ["**/*.test.ts", "**/*.test.tsx"], rules: { "ferry/ctx-constructors": "error", "ferry/privileged-imports": "error" } },
  // Audio and transcript text must never reach disk from the relay or capture core (tests spy on fs and are exempt).
  { files: ["src/server/relay/**", "src/core/capture/**"], ignores: ["**/*.test.ts"], rules: { "ferry/no-capture-persistence": "error" } },
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
    // Bundled by `bun run build:sw` from src/pwa and src/ui/capture, which are linted.
    "public/sw.js",
    "public/worklets/**",
  ]),
]);

export default eslintConfig;
