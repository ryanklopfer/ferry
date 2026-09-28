import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/ctx";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getSessionUser()) redirect("/home");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <div>
        <h1 className="font-display text-h1">Let&apos;s get you in.</h1>
        <p className="mt-1 text-secondary text-slate">No password to remember. We&apos;ll email you a link that signs you in.</p>
      </div>
      <SignInForm linkProblem={Boolean(error)} />
    </div>
  );
}
