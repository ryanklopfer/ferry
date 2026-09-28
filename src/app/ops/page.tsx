import { requireStaff } from "@/server/auth/ctx";

// Placeholder until staff tasks (S9).
export default async function OpsHome() {
  await requireStaff();
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="font-display text-h1">Ops</h1>
      <p className="text-secondary text-slate">Nothing needs a hand right now.</p>
    </div>
  );
}
