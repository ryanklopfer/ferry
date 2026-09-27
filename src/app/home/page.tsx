import { redirect } from "next/navigation";
import { requireCtx } from "@/server/auth/ctx";

// The installed app opens here (manifest start_url). N2b replaces this with the redirect by role.
export default async function HomePage() {
  await requireCtx();
  redirect("/");
}
