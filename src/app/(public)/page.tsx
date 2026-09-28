import { isPrelaunch } from "@/server/deploy";
import { HomePage } from "@/ui/home/home-page";

// Rendered per request: one build serves both the prelaunch preview and the live site, so "Start free" follows the
// tier the server runs in, not the one it was built in.
export const dynamic = "force-dynamic";

export default function LandingPage() {
  return <HomePage prelaunch={isPrelaunch()} />;
}
