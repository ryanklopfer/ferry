import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./index";

const ROLES = ["pending", "clinician", "client", "staff"] as const;
export type Role = (typeof ROLES)[number];

// userId is always the tenant (the clinician) for contexts that reach tenant repos. See architecture §6.
export type ClinicianCtx = { scope: "clinician"; userId: string };
export type SelfCtx = { scope: "self"; userId: string };
export type ClientCtx = { scope: "client"; userId: string; clientId: string; actorId: string };
export type InviteCtx = { scope: "invite"; userId: string; clientId: string; actorId: string; linkId: string };
export type SystemCtx = { scope: "system"; userId: string; job: string };
export type StaffCtx = { scope: "staff"; userId: string };

export type Ctx = ClinicianCtx | ClientCtx | SystemCtx;
export type ClinicianOnlyCtx = ClinicianCtx | SystemCtx;

export type SessionUser = { userId: string; role: Role };

export async function sessionFromHeaders(h: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  const role = ROLES.find((r) => r === session.user.role);
  return role ? { userId: session.user.id, role } : null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return sessionFromHeaders(await headers());
}

// Any role, pending included. It yields no context a repo accepts.
export async function requireSignedIn(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

// For route handlers, which answer rather than redirect: 401 when signed out, 404 for any other role (as the page guards do).
export async function getClinician(): Promise<ClinicianCtx | 401 | 404> {
  const user = await getSessionUser();
  if (!user) return 401;
  return user.role === "clinician" ? { scope: "clinician", userId: user.userId } : 404;
}

export async function getClient(): Promise<SelfCtx | 401 | 404> {
  const user = await getSessionUser();
  if (!user) return 401;
  return user.role === "client" ? { scope: "self", userId: user.userId } : 404;
}

async function requireRole(role: Role): Promise<string> {
  const user = await requireSignedIn();
  if (user.role !== role) notFound();
  return user.userId;
}

export async function requireClinician(): Promise<ClinicianCtx> {
  return { scope: "clinician", userId: await requireRole("clinician") };
}

export async function requireClient(): Promise<SelfCtx> {
  return { scope: "self", userId: await requireRole("client") };
}

export async function requireStaff(): Promise<StaffCtx> {
  return { scope: "staff", userId: await requireRole("staff") };
}
