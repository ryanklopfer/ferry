import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { BRAND } from "@/core/brand";
import { db } from "@/server/db";
import { email } from "@/server/integrations/email";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

export const auth = betterAuth({
  baseURL,
  secret: process.env.VITEST ? "test-only-secret-never-used-outside-vitest" : process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  emailAndPassword: { enabled: false },
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "pending", input: false },
    },
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_TTL_SECONDS,
      storeToken: "hashed",
      sendMagicLink: async ({ email: to, url }) => {
        await email.send({
          to,
          subject: `Your ${BRAND.name} sign-in link`,
          text: `Here's your link to sign in. It works once and lasts 15 minutes.\n\n${url}\n\nIf you didn't ask for this, you can ignore it.`,
          signInLink: url,
        });
      },
    }),
    passkey({ rpID: new URL(baseURL).hostname, rpName: BRAND.name, origin: baseURL }),
    nextCookies(),
  ],
});
