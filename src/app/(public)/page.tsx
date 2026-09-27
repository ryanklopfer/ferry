import { BRAND } from "@/core/brand";

// Placeholder until the homepage lands (S11c).
export default function LandingPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="text-3xl font-semibold tracking-tight">{BRAND.name}</h1>
      <p className="text-sm text-stone-600">Your notes, written for you. Your clients&apos; out-of-network claims, filed and chased.</p>
      <div className="flex gap-3">
        <a className="btn-primary" href="/start">Get started</a>
        <a className="btn-secondary" href="/sign-in">Log in</a>
      </div>
    </div>
  );
}
