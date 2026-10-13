import Link from "next/link";

import { AuthCard } from "@/components/ui";
import { messages } from "@/lib/messages";

import { LoginForm } from "./login-form";

const m = messages.auth;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <AuthCard title={m.loginTitle}>
      <LoginForm next={next} linkError={error === "link"} />
      <p className="text-center text-sm text-slate-600">
        {m.noAccount}{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          {m.toSignup}
        </Link>
      </p>
    </AuthCard>
  );
}
