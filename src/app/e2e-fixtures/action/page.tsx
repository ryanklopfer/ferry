import { notFound } from "next/navigation";
import { requireSignedIn } from "@/server/auth/ctx";
import { E2E_FIXTURES_ON } from "../enabled";
import { failingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ActionFixturePage() {
  if (!E2E_FIXTURES_ON()) notFound();
  await requireSignedIn();
  return (
    <form action={failingAction}>
      <button type="submit">Run the failing action</button>
    </form>
  );
}
