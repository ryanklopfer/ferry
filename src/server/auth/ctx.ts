import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";

const ROLES = ["patient", "provider", "staff"] as const;
export type Role = (typeof ROLES)[number];
export type Ctx = { userId: string; role: Role };

export async function ctxFromHeaders(h: Headers): Promise<Ctx | null> {
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  const role = ROLES.find((r) => r === session.user.role);
  return role ? { userId: session.user.id, role } : null;
}

export async function getCtx(): Promise<Ctx | null> {
  return ctxFromHeaders(await headers());
}

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/sign-in");
  return ctx;
}
