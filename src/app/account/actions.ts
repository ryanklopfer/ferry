"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { requireSignedIn } from "@/server/auth/ctx";

// Done on the server so another session's token never reaches the browser.
export async function endSession(fd: FormData) {
  await requireSignedIn();
  const id = String(fd.get("id") ?? "");
  const h = await headers();
  const sessions = await auth.api.listSessions({ headers: h });
  const target = sessions.find((s) => s.id === id);
  if (target) await auth.api.revokeSession({ headers: h, body: { token: target.token } });
  revalidatePath("/account");
}
