"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type AuthFormState, signUp } from "../actions";

const m = messages.auth;

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});

  if (state.success) return <Alert tone="success">{state.success}</Alert>;

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label={m.fullName}>
        <Input name="fullName" autoComplete="name" required />
      </Field>
      <Field label={m.email}>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </Field>
      <Field label={m.password} hint={m.passwordHint}>
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {m.signup}
      </Button>
    </form>
  );
}
