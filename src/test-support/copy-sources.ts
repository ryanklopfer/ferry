import fs from "node:fs";
import path from "node:path";

// The files the copy checks (banned-patterns, pricing-grep) scan: code, styles, docs and data under src/ and content/.
const ROOT = process.cwd();
const SCANNED = /\.(tsx?|css|m?js|md|json)$/;

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : [path.relative(ROOT, full)];
  });
}

// `self` is the calling test's own file, left out so its fixtures don't match its own patterns.
export function copySources(self: string): { file: string; text: string }[] {
  const skip = path.relative(ROOT, self);
  return [...files(path.join(ROOT, "src")), ...files(path.join(ROOT, "content"))]
    .filter((f) => f !== skip && SCANNED.test(f))
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(ROOT, f), "utf8") }));
}
