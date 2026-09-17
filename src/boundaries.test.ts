import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

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
});
