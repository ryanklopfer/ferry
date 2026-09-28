import { BRAND } from "@/core/brand";
import { ButtonLink } from "@/ui/button";

// Placeholder until the homepage lands (S11c).
export default function LandingPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="font-display text-h1">{BRAND.name}</h1>
      <p className="text-secondary text-slate">Your notes, written for you. Your clients&apos; out-of-network claims, filed and chased.</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink variant="primary" href="/start">Get started</ButtonLink>
        <ButtonLink variant="secondary" href="/sign-in">Log in</ButtonLink>
      </div>
    </div>
  );
}
