import fs from "node:fs/promises";
import path from "node:path";
import { type Mode, modeFor, NotConfigured, vendorOff } from "@/server/integrations/mode";

// signInLink marks sign-in mail: the one message whose link the fixture prints, so dev sign-in works.
export type EmailMessage = { to: string; subject: string; text: string; html?: string; signInLink?: string };
export type EmailSender = { send(message: EmailMessage): Promise<void> };

export const sentInThisProcess: EmailMessage[] = [];

export const outboxDir = () => process.env.FERRY_OUTBOX_DIR || path.join(process.cwd(), "data", "outbox");

// Nothing leaves the machine. The body goes only to the outbox file, never to the console.
const fixture: EmailSender = {
  async send(message) {
    sentInThisProcess.push(message);
    const dir = outboxDir();
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    await fs.writeFile(file, JSON.stringify(message, null, 2));
    console.log(`[email:fixture] ${file}${message.signInLink ? `\n[email:fixture] sign-in link ${message.signInLink}` : ""}`);
  },
};

const notConfigured = (mode: Mode): EmailSender => ({
  async send() {
    throw new NotConfigured("email", mode);
  },
});

function senderFor(mode: Mode): EmailSender {
  switch (mode) {
    case "fixture":
    case "local":
      return fixture;
    case "off":
      return { send: async () => vendorOff("email") };
    case "live":
    case "test":
      return notConfigured(mode);
  }
}

export const email: EmailSender = { send: async (message) => senderFor(modeFor("email")).send(message) };
