import Link from "next/link";

import { AuthCard } from "@/components/ui";
import { messages } from "@/lib/messages";

import { SignupForm } from "./signup-form";

const m = messages.auth;

export default function SignupPage() {
  return (
    <AuthCard title={m.signupTitle}>
      <SignupForm />
      <p className="text-center text-sm text-slate-600">
        {m.hasAccount}{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          {m.toLogin}
        </Link>
      </p>
    </AuthCard>
  );
}
