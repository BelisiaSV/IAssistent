"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type AuthFormState, sendMagicLink, signInWithPassword } from "../actions";

const m = messages.auth;

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [passwordState, passwordAction, passwordPending] = useActionState<AuthFormState, FormData>(
    signInWithPassword,
    {},
  );
  const [linkState, linkAction, linkPending] = useActionState<AuthFormState, FormData>(
    sendMagicLink,
    {},
  );

  const error = passwordState.error ?? linkState.error ?? (linkError ? m.errors.linkInvalid : undefined);
  const pending = passwordPending || linkPending;

  return (
    <form className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {linkState.success && <Alert tone="success">{linkState.success}</Alert>}

      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={m.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={passwordState.email ?? linkState.email}
        />
      </Field>
      <Field label={m.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>

      <Button type="submit" formAction={passwordAction} disabled={pending} className="w-full">
        {m.login}
      </Button>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        {m.or}
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        type="submit"
        variant="secondary"
        formAction={linkAction}
        formNoValidate
        disabled={pending}
        className="w-full"
      >
        {m.sendMagicLink}
      </Button>
    </form>
  );
}
