import fs from "node:fs/promises";
import path from "node:path";

export type OutboxMessage = { to: string; subject: string; text: string; signInLink?: string };

export const OUTBOX = path.join(process.cwd(), "data", "outbox");

async function read(recipient: string): Promise<OutboxMessage[]> {
  const files = (await fs.readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort();
  const all = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(OUTBOX, f), "utf8")) as OutboxMessage));
  return all.filter((m) => m.to.toLowerCase() === recipient.toLowerCase());
}

// Mail the fixture email sender wrote for this recipient, oldest first. Waits for at least `count`.
export async function mailTo(recipient: string, { count = 1, timeoutMs = 15_000 } = {}): Promise<OutboxMessage[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await read(recipient);
    if (found.length >= count || Date.now() > deadline) return found;
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function signInLinkFor(recipient: string, { after = 0 } = {}): Promise<string> {
  const mail = await mailTo(recipient, { count: after + 1 });
  const link = mail.at(-1)?.signInLink;
  if (mail.length <= after || !link) throw new Error(`No sign-in mail for ${recipient} in ${OUTBOX}`);
  return link;
}
