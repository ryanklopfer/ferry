import { requireClient } from "@/server/auth/ctx";

// Placeholder until client views arrive with memberships (N4, N7a).
export default async function ClientHome() {
  await requireClient();
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="text-xl font-semibold">Your trips</h1>
      <p className="text-sm text-stone-600">Nothing on the water right now.</p>
    </div>
  );
}
