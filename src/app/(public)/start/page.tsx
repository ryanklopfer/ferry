import type { Metadata } from "next";

export const metadata: Metadata = { title: "Get started" };

// Plain links: choosing a door never changes a role. Clinician sign-up (N5) replaces the clinician door, which
// until then explains itself here rather than sending a pending user through /sign-in and /home back to /start.
// A client joins through their clinician's invite (N7a).
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const { door } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="text-xl font-semibold">Who&apos;s joining us?</h1>
      {door === "clinician" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          Clinician sign-up opens soon. There&apos;s nothing to set up before then.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <a className="btn-primary text-center" href="/start?door=clinician">I&apos;m a clinician</a>
        <a className="btn-secondary text-center" href="/for-clients">I&apos;m a client</a>
      </div>
    </div>
  );
}
