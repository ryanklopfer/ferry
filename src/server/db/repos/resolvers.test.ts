import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/server/db";
import { createTestUser, resetDb } from "@/server/db/testing";
import { claimsRepo } from "./claims";
import { clientsRepo } from "./clients";
import { plansRepo } from "./plans";
import { resolvers } from "./resolvers";

const REPOS = path.join(process.cwd(), "src", "server", "db", "repos");
// The ctx-less lookups (architecture §6 rule 8).
const RESOLVERS = "resolvers.ts";
// Better Auth's users table has no tenant; lint (ferry/privileged-imports) confines this module to services/roles.ts and services/invites.ts.
const AUTH_OWNED = ["users.ts"];

type Fn = { name: string; firstParam: ts.ParameterDeclaration | undefined };

function exportedFunctions(source: ts.SourceFile): Fn[] {
  const out: Fn[] = [];
  const isExported = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const fromExpression = (name: string, e: ts.Expression | undefined) => {
    if (!e) return;
    if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) out.push({ name, firstParam: e.parameters[0] });
    if (ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) {
        const key = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? `${name}.${p.name.text}` : `${name}.?`;
        if (ts.isMethodDeclaration(p)) out.push({ name: key, firstParam: p.parameters[0] });
        else if (ts.isPropertyAssignment(p)) fromExpression(key, p.initializer);
      }
    }
  };
  for (const s of source.statements) {
    if (!isExported(s)) continue;
    if (ts.isFunctionDeclaration(s)) out.push({ name: s.name?.text ?? "default", firstParam: s.parameters[0] });
    if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) fromExpression(d.name.getText(source), d.initializer);
  }
  return out;
}

const takesCtx = (p: ts.ParameterDeclaration | undefined, source: ts.SourceFile) => !!p?.type && /^\w*Ctx( \| \w*Ctx)*$/.test(p.type.getText(source));
const holdsDb = (source: ts.SourceFile) => source.statements.some((s) => ts.isImportDeclaration(s) && /^(\.\.\/index|@\/server\/db)$/.test((s.moduleSpecifier as ts.StringLiteral).text));

function ctxlessExports(file: string, code: string): string[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  if (!holdsDb(source)) return [];
  return exportedFunctions(source).filter((f) => !takesCtx(f.firstParam, source)).map((f) => `${file}: ${f.name}`);
}

describe("resolvers.ts is the only repo module with ctx-less functions", () => {
  it("catches a ctx-less export in any form", () => {
    const head = 'import { db } from "../index";\n';
    expect(ctxlessExports("x.ts", `${head}export const xRepo = { get(id: string) { return db; } };`)).toEqual(["x.ts: xRepo.get"]);
    expect(ctxlessExports("x.ts", `${head}export const xRepo = { get: async (id: string) => db };`)).toEqual(["x.ts: xRepo.get"]);
    expect(ctxlessExports("x.ts", `${head}export async function find(email: string) { return db; }`)).toEqual(["x.ts: find"]);
    expect(ctxlessExports("x.ts", `${head}export const all = () => db;`)).toEqual(["x.ts: all"]);
    expect(ctxlessExports("x.ts", `${head}export const xRepo = { list(ctx: Ctx) { return db; }, get(ctx: ClinicianOnlyCtx, id: string) { return db; } };`)).toEqual([]);
    expect(ctxlessExports("x.ts", `${head}export function f(ctx: ClinicianCtx | SystemCtx) { return db; }`)).toEqual([]);
  });

  it("holds for every module under repos", () => {
    const files = fs.readdirSync(REPOS).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files).toContain(RESOLVERS);
    const offenders = files.filter((f) => f !== RESOLVERS && !AUTH_OWNED.includes(f)).flatMap((f) => ctxlessExports(f, fs.readFileSync(path.join(REPOS, f), "utf8")));
    expect(offenders).toEqual([]);
    expect(ctxlessExports(RESOLVERS, fs.readFileSync(path.join(REPOS, RESOLVERS), "utf8")).length).toBeGreaterThan(0);
  });
});

describe("resolvers", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("resolves a patient control number to its tenant and claim id, and nothing else", async () => {
    const x = await createTestUser("clinician", "x@example.test");
    const client = await clientsRepo.create(x, { firstName: "Ana", lastName: "Ortiz", dob: null, email: null, phone: null });
    const plan = await plansRepo.create(x, client.id, { insurerName: "Aetna", memberId: "W1", subscriberName: "Ana Ortiz", patientName: "Ana Ortiz" });
    const claim = await claimsRepo.create(x, { planId: plan.id }, []);
    expect(await resolvers.claimByPatientControlNumber(claim.id)).toEqual({ tenant: x.userId, claimId: claim.id });
    expect(await resolvers.claimByPatientControlNumber("clm_unknown")).toBeNull();
  });
});
