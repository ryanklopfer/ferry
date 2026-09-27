import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function flagged(filePath: string, code: string, ruleId: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === ruleId).map((m) => m.message);
}

async function restricted(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

// The layering only holds if breaking it fails the build. These are the breaks we care about.
describe("import boundaries", () => {
  it("stops a page from importing Drizzle", async () => {
    expect(await restricted("src/app/x/page.tsx", 'import { eq } from "drizzle-orm";\nexport default eq;\n')).toHaveLength(1);
  });

  it("stops a page from importing the database module or a repo", async () => {
    expect(await restricted("src/app/x/page.tsx", 'import { db } from "@/server/db";\nexport default db;\n')).toHaveLength(1);
    expect(await restricted("src/app/x/page.tsx", 'import { claimsRepo } from "@/server/db/repos/claims";\nexport default claimsRepo;\n')).toHaveLength(1);
  });

  it("stops a component from importing row types straight from the schema", async () => {
    expect(await restricted("src/components/x.tsx", 'import type { Claim } from "@/server/db/schema";\nexport type X = Claim;\n')).toHaveLength(1);
  });

  it("lets a page use services", async () => {
    expect(await restricted("src/app/x/page.tsx", 'import { listClaims } from "@/server/services/claims";\nexport default listClaims;\n')).toEqual([]);
  });

  it("keeps src/core free of Next, Node, Drizzle and server code", async () => {
    for (const source of ["next/headers", "node:fs", "drizzle-orm", "@/server/db", "@/server/services/claims", "@/lib/ai", "react"]) {
      expect(await restricted("src/core/x.ts", `import x from "${source}";\nexport default x;\n`), source).toHaveLength(1);
    }
  });

  it("lets src/core use zod, date-fns and itself", async () => {
    expect(await restricted("src/core/x.ts", 'import { z } from "zod";\nimport { format } from "date-fns";\nimport { BRAND } from "./brand";\nexport default [z, format, BRAND];\n')).toEqual([]);
  });

  it("stops a service from reaching past the repos to the database handle", async () => {
    expect(await restricted("src/server/services/x.ts", 'import { db } from "@/server/db";\nexport default db;\n')).toHaveLength(1);
    expect(await restricted("src/server/services/x.ts", 'import { claimsRepo } from "@/server/db/repos/claims";\nexport default claimsRepo;\n')).toEqual([]);
  });

  it("keeps the direct Anthropic SDK out of everything but src/lib/ai.ts and the llm integration", async () => {
    const code = 'import Anthropic from "@anthropic-ai/sdk";\nexport default Anthropic;\n';
    expect(await flagged("src/server/services/x.ts", code, "ferry/no-direct-anthropic")).toHaveLength(1);
    expect(await flagged("src/app/x/page.tsx", code, "ferry/no-direct-anthropic")).toHaveLength(1);
    expect(await flagged("src/server/services/x.ts", 'export const load = () => import("@anthropic-ai/sdk");\n', "ferry/no-direct-anthropic")).toHaveLength(1);
    expect(await flagged("src/lib/ai.ts", code, "ferry/no-direct-anthropic")).toEqual([]);
    expect(await flagged("src/server/integrations/llm/anthropic.ts", code, "ferry/no-direct-anthropic")).toEqual([]);
  });

  it("keeps disk, storage and database writes out of the capture relay and capture core, including files added later", async () => {
    const rule = "ferry/no-capture-persistence";
    const bad = [
      'import fs from "node:fs";\nexport default fs;\n',
      'import { writeFileSync } from "node:fs";\nexport default writeFileSync;\n',
      'import { writeFile } from "node:fs/promises";\nexport default writeFile;\n',
      'import { appendFile } from "fs/promises";\nexport default appendFile;\n',
      'import fs from "fs";\nexport default fs;\n',
      'export { writeFile } from "node:fs/promises";\n',
      'import { putObject } from "@/server/storage";\nexport default putObject;\n',
      'import { db } from "@/server/db";\nexport default db;\n',
      'import { capturesRepo } from "@/server/db/repos/captures";\nexport default capturesRepo;\n',
      'export const load = () => import("node:fs");\n',
      "export const save = (b: Uint8Array) => Bun.write(\"/tmp/a.pcm\", b);\n",
      "export const open = () => Bun.file(\"/tmp/a.pcm\");\n",
      "export const save = (b: Uint8Array) => globalThis.Bun.write(\"/tmp/a.pcm\", b);\n",
    ];
    for (const file of ["src/server/relay/scribe-stream.ts", "src/core/capture/segments.ts"]) {
      for (const code of bad) expect(await flagged(file, code, rule), `${file}: ${code}`).not.toHaveLength(0);
    }
    expect(await flagged("src/server/relay/x.ts", 'import { db } from "../db";\nexport default db;\n', rule)).not.toHaveLength(0);
    expect(await flagged("src/core/capture/x.ts", 'import { put } from "../../server/storage";\nexport default put;\n', rule)).not.toHaveLength(0);
    expect(await flagged("src/server/relay/server.ts", 'import { log } from "@/server/log";\nimport { importDictation } from "@/server/services/captures";\nexport default [log, importDictation];\n', rule)).toEqual([]);
    expect(await flagged("src/server/relay/relay.test.ts", 'import fs from "node:fs";\nexport default fs;\n', rule)).toEqual([]);
  });

  it("bans 'use cache' and unstable_cache on PHI paths, but not on public pages", async () => {
    const directive = '"use cache";\nexport default async function Page() {\n  return null;\n}\n';
    const inner = 'export async function load() {\n  "use cache";\n  return 1;\n}\n';
    expect(await flagged("src/app/app/clients/page.tsx", directive, "ferry/no-phi-cache")).toHaveLength(1);
    expect(await flagged("src/app/api/v1/claims/route.ts", inner, "ferry/no-phi-cache")).toHaveLength(1);
    expect(await flagged("src/server/services/x.ts", 'import { unstable_cache } from "next/cache";\nexport default unstable_cache;\n', "ferry/no-phi-cache")).not.toHaveLength(0);
    expect(await flagged("src/app/c/page.tsx", 'import { cacheLife } from "next/cache";\nexport default cacheLife;\n', "ferry/no-phi-cache")).not.toHaveLength(0);
    expect(await flagged("src/lib/packet.ts", inner, "ferry/no-phi-cache")).toHaveLength(1);
    expect(await flagged("src/components/follow-up-card.tsx", inner, "ferry/no-phi-cache")).toHaveLength(1);
    expect(await flagged("src/ui/client-list.tsx", inner, "ferry/no-phi-cache")).toHaveLength(1);
    expect(await flagged("src/app/(public)/page.tsx", directive, "ferry/no-phi-cache")).toEqual([]);
  });
});
