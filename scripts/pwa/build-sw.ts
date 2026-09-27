import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Bundles the service worker to public/sw.js and each src/ui/capture/*-worklet.ts to public/worklets/<name>.js.
// Both outputs are build products (gitignored); dev, build and the e2e server run this first.
const root = fileURLToPath(new URL("../..", import.meta.url));
const rel = (...p: string[]) => path.join(root, ...p);

const list = (dir: string, match: RegExp) => (fs.existsSync(rel(dir)) ? fs.readdirSync(rel(dir)).filter((f) => match.test(f)).sort().map((f) => path.join(dir, f)) : []);
const tree = (dir: string): string[] =>
  fs
    .readdirSync(rel(dir), { withFileTypes: true })
    .filter((d) => !d.name.startsWith("."))
    .flatMap((d) => (d.isDirectory() ? tree(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const worklets = list("src/ui/capture", /-worklet\.ts$/);

// Everything next build reads, so each deploy that can change /offline or the hashed chunks installs a new worker,
// whose install fetches a fresh /offline and whose activate drops the previous deploy's cache.
const versioned = [
  ...tree("src").filter((f) => !/\.test\.tsx?$/.test(f)),
  ...tree("public").filter((f) => f !== "public/sw.js" && !f.startsWith("public/worklets/")),
  ...["package.json", "bun.lock", "next.config.ts", "postcss.config.mjs", "tsconfig.json"],
].sort();

const hash = createHash("sha256");
for (const f of versioned) hash.update(f).update(fs.readFileSync(rel(f)));
const version = hash.digest("hex").slice(0, 12);

function bundle(entry: string, outfile: string, define: string[] = []) {
  const args = ["build", rel(entry), "--outfile", rel(outfile), "--target", "browser", "--format", "esm", "--minify", ...define.flatMap((d) => ["--define", d])];
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build:sw failed for ${entry}\n${r.stderr}`);
}

bundle("src/pwa/sw.ts", "public/sw.js", [`__SHELL_VERSION__=${JSON.stringify(version)}`]);
fs.rmSync(rel("public/worklets"), { recursive: true, force: true });
for (const w of worklets) bundle(w, path.join("public/worklets", `${path.basename(w, "-worklet.ts")}.js`));
console.log(`build:sw ${version}: public/sw.js${worklets.length ? ` and ${worklets.length} worklet(s)` : ""}`);
