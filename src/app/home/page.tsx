import { redirect } from "next/navigation";
import { type Role, requireSignedIn } from "@/server/auth/ctx";

const HOME: Record<Role, string> = { clinician: "/app", client: "/c", staff: "/ops", pending: "/start" };

// The installed app and every sign-in land here (manifest start_url), and each role goes to its own area.
export default async function HomePage() {
  const { role } = await requireSignedIn();
  redirect(HOME[role]);
}
