import { format } from "date-fns";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { requireSignedIn } from "@/server/auth/ctx";
import { AddPasskey, RemovePasskey, SignOut } from "./account-actions";
import { endSession } from "./actions";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Tag } from "@/ui/chip";

function device(userAgent: string | null | undefined): string {
  if (!userAgent) return "A browser";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "A browser";
  const os = /iPhone|iPad/.test(userAgent) ? "iPhone or iPad" : /Android/.test(userAgent) ? "Android" : /Mac OS X/.test(userAgent) ? "Mac" : /Windows/.test(userAgent) ? "Windows" : null;
  return os ? `${browser} on ${os}` : browser;
}

export default async function AccountPage() {
  await requireSignedIn();
  const h = await headers();
  const [current, sessions, passkeys] = await Promise.all([
    auth.api.getSession({ headers: h }),
    auth.api.listSessions({ headers: h }),
    auth.api.listPasskeys({ headers: h }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-h1">Your account</h1>
        <p className="mt-1 text-secondary text-slate">{current?.user.email}</p>
      </div>

      <Card as="section">
        <div>
          <h2 className="font-display text-h3">Passkeys</h2>
          <p className="text-secondary text-slate">Sign in with your fingerprint or face, no email needed.</p>
        </div>
        {passkeys.length > 0 && (
          <ul className="space-y-2">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-secondary">
                <span>{p.name ?? "Passkey"}{p.createdAt ? ` · added ${format(p.createdAt, "MMM d")}` : ""}</span>
                <RemovePasskey id={p.id} />
              </li>
            ))}
          </ul>
        )}
        <AddPasskey />
      </Card>

      <Card as="section">
        <h2 className="font-display text-h3">Where you&apos;re signed in</h2>
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 text-secondary">
              <span>
                {device(s.userAgent)} · since {format(s.createdAt, "MMM d")}
                {s.id === current?.session.id && (
                  <span className="ml-2">
                    <Tag>This one</Tag>
                  </span>
                )}
              </span>
              {s.id !== current?.session.id && (
                <form action={endSession}>
                  <input type="hidden" name="id" value={s.id} />
                  <Button variant="tertiary" type="submit">
                    Sign it out
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <SignOut />
    </div>
  );
}
