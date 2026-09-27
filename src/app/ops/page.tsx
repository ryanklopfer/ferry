import { requireStaff } from "@/server/auth/ctx";

// Placeholder until staff tasks (S9).
export default async function OpsHome() {
  await requireStaff();
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="text-xl font-semibold">Ops</h1>
      <p className="text-sm text-stone-600">Nothing needs a hand right now.</p>
    </div>
  );
}
