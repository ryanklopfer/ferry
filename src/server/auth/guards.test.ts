import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEV_PUBLIC_PATHS, isPublicPath, PUBLIC_PATHS } from "@/proxy";

const APP = path.join(process.cwd(), "src", "app");
const PUBLIC_ROUTES = new Set(["api/auth/[...all]/route.ts"]);

// The allow-list, written out again on purpose: widening src/proxy.ts has to change this line too.
const EXPECTED_PUBLIC_PATHS = ["/", "/start", "/for-clients", "/i/*", "/legal/*", "/offline", "/manifest.webmanifest", "/sw.js", "/worklets/*", "/icons/*", "/api/webhooks/*", "/sign-in", "/api/auth/*"];
const EXPECTED_DEV_PUBLIC_PATHS = ["/dev/*", "/api/dev/*"];

function find(dir: string, name: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return find(full, name);
    return e.name === name ? [path.relative(APP, full)] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(APP, rel), "utf8");

const ANY_GUARD = /\brequire(Clinician|Client|Staff|SignedIn)\(/;
const ROUTE_GUARD = /\b(getClinician|getSessionUser|require(Clinician|Client|Staff|SignedIn))\(/;
const ACTION_GUARD = /^ {2}(const \w+ = )?await require(Clinician|Client|Staff|SignedIn)\(\);$/gm;
// The phone spike's pages have no session; they 404 unless the dev tier and this run's key check passes.
const SPIKE_GUARD = /\bspikeKeyValid\(/;
const AREAS: [RegExp, RegExp, string][] = [
  [/^\/app(\/|$)/, /\brequireClinician\(/, "requireClinician()"],
  [/^\/c(\/|$)/, /\brequireClient\(/, "requireClient()"],
  [/^\/ops(\/|$)/, /\brequireStaff\(/, "requireStaff()"],
];

// "(public)/offline/page.tsx" is served at /offline: route groups add no segment.
function urlFor(file: string): string {
  const segments = path.dirname(file).split(path.sep).filter((s) => s !== "." && !/^\(.*\)$/.test(s));
  return `/${segments.map((s) => s.replace(/^\[+\.*|\]+$/g, "")).join("/")}`;
}

// Every page is either inside a signed-in area with that area's guard, or public and on PUBLIC_PATHS.
function pageViolations(pages: { file: string; source: string }[]): string[] {
  return pages.flatMap(({ file, source }) => {
    const url = urlFor(file);
    const area = AREAS.find(([prefix]) => prefix.test(url));
    if (area) return area[1].test(source) ? [] : [`${file}: ${url} must call ${area[2]}`];
    if (/^\/dev(\/|$)/.test(url)) return SPIKE_GUARD.test(source) ? [] : [`${file}: ${url} must check the spike key`];
    if (/^\(public\)\//.test(file) && !isPublicPath(url, false)) return [`${file}: ${url} is in (public) but not on PUBLIC_PATHS`];
    if (ANY_GUARD.test(source) || isPublicPath(url, false)) return [];
    return [`${file}: ${url} has no guard and is not on PUBLIC_PATHS`];
  });
}

describe("PUBLIC_PATHS", () => {
  it("is exactly the reviewed allow-list", () => {
    expect([...PUBLIC_PATHS]).toEqual(EXPECTED_PUBLIC_PATHS);
    expect([...DEV_PUBLIC_PATHS]).toEqual(EXPECTED_DEV_PUBLIC_PATHS);
  });
});

describe("the page checker", () => {
  const page = (file: string, source: string) => pageViolations([{ file, source }]);

  it("maps files to the URL Next serves", () => {
    expect(urlFor("page.tsx")).toBe("/");
    expect(urlFor("(public)/offline/page.tsx")).toBe("/offline");
    expect(urlFor("i/[token]/page.tsx")).toBe("/i/token");
    expect(urlFor("app/clients/[id]/page.tsx")).toBe("/app/clients/id");
  });

  it("fails an /app page without requireClinician()", () => {
    expect(page("app/clients/page.tsx", "await requireClient();")).toHaveLength(1);
    expect(page("app/clients/page.tsx", "await requireSignedIn();")).toHaveLength(1);
    expect(page("app/page.tsx", "export default function P() {}")).toHaveLength(1);
    expect(page("app/clients/page.tsx", "await requireClinician();")).toEqual([]);
  });

  it("fails a /c page without requireClient()", () => {
    expect(page("c/trips/page.tsx", "await requireClinician();")).toHaveLength(1);
    expect(page("c/page.tsx", "await requireClient();")).toEqual([]);
  });

  it("fails an /ops page without requireStaff()", () => {
    expect(page("ops/tasks/page.tsx", "await requireClinician();")).toHaveLength(1);
    expect(page("ops/page.tsx", "await requireStaff();")).toEqual([]);
  });

  it("fails a public page missing from PUBLIC_PATHS", () => {
    expect(page("(public)/pricing/page.tsx", "export default function P() {}")).toHaveLength(1);
    expect(page("pricing/page.tsx", "export default function P() {}")).toHaveLength(1);
    expect(page("(public)/for-clients/page.tsx", "export default function P() {}")).toEqual([]);
    expect(page("i/[token]/page.tsx", "export default function P() {}")).toEqual([]);
  });

  it("lets a signed-in page outside the areas use any guard", () => {
    expect(page("account/page.tsx", "await requireSignedIn();")).toEqual([]);
  });

  it("fails a dev page that does not check the spike key", () => {
    expect(page("dev/x/page.tsx", "await requireSignedIn();")).toHaveLength(1);
    expect(page("dev/x/page.tsx", "if (!spikeKeyValid(k)) notFound();")).toEqual([]);
  });
});

// A new page, route or action that forgets the session check fails here, not in production.
describe("every entry point verifies the session", () => {
  it("pages carry their area's guard, or are public and on PUBLIC_PATHS", () => {
    const pages = find(APP, "page.tsx").map((file) => ({ file, source: read(file) }));
    expect(pages.length).toBeGreaterThan(0);
    expect(pageViolations(pages)).toEqual([]);
  });

  it("the public pages this slice promises exist", () => {
    const urls = find(APP, "page.tsx").map(urlFor);
    for (const url of ["/", "/start", "/for-clients", "/i/token", "/legal/doc", "/offline", "/sign-in", "/app", "/c", "/ops", "/home"]) expect(urls, url).toContain(url);
  });

  it("route handlers check the session", () => {
    const unguarded = find(APP, "route.ts").filter((p) => !PUBLIC_ROUTES.has(p) && !(/^(api\/)?dev\//.test(p) ? SPIKE_GUARD : ROUTE_GUARD).test(read(p)));
    expect(unguarded).toEqual([]);
  });

  it("every server action starts with a require guard", () => {
    const files = [...find(APP, "actions.ts")].filter((p) => read(p).startsWith('"use server"'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = read(file);
      const actions = source.match(/^export async function \w+/gm) ?? [];
      const checks = source.match(ACTION_GUARD) ?? [];
      expect(actions.length, `${file} exports no actions`).toBeGreaterThan(0);
      expect(checks.length, `${file}: every action must start with await requireClinician() (or another require guard)`).toBe(actions.length);
    }
  });
});
