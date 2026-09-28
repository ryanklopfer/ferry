import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { type ConsentDocType, LEGAL_SLUG } from "@/core/legal";

// A copy of content/legal that the dev-tier loader reads through FERRY_LEGAL_DIR, so a test can bump a version or
// flip a placeholder without touching the repo's texts.
export function tempLegalDir() {
  const dir = path.join(os.tmpdir(), `ferry-legal-${randomBytes(4).toString("hex")}`);
  fs.cpSync(path.join(process.cwd(), "content", "legal"), dir, { recursive: true });
  process.env.FERRY_LEGAL_DIR = dir;
  const file = (t: ConsentDocType) => path.join(dir, `${LEGAL_SLUG[t]}.md`);
  const edit = (t: ConsentDocType, change: (source: string) => string) => fs.writeFileSync(file(t), change(fs.readFileSync(file(t), "utf8")));
  return {
    dir,
    bump(t: ConsentDocType) {
      edit(t, (s) => s.replace(/^version: (\d+)\.(\d+)\.(\d+)$/m, (_, a, b, c) => `version: ${a}.${b}.${Number(c) + 1}`) + "\nA sentence added in this version.\n");
    },
    setPlaceholder(t: ConsentDocType, on: boolean) {
      edit(t, (s) => s.replace(/^placeholder: (true|false)$/m, `placeholder: ${on}`));
    },
    restore() {
      delete process.env.FERRY_LEGAL_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
