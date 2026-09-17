import fs from "node:fs/promises";
import path from "node:path";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type EmailSender = { send(message: EmailMessage): Promise<void> };

export const sentInThisProcess: EmailMessage[] = [];

// Dev and test only: nothing leaves the machine. The real sender (SES) arrives with the deploy slice.
const fixture: EmailSender = {
  async send(message) {
    if (process.env.NODE_ENV === "production") throw new Error("The fixture email sender must not run in production");
    sentInThisProcess.push(message);
    if (process.env.VITEST) return;
    const dir = path.join(process.cwd(), "data", "outbox");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify(message, null, 2));
    console.log(`[email:fixture] to ${message.to} | ${message.subject}\n${message.text}`);
  },
};

export const email: EmailSender = fixture;
