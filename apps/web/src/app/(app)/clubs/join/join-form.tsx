"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { redeemCode } from "@/lib/clubs/actions";
import type { FormState } from "@/lib/clubs/form-state";
import { messages } from "@/lib/messages";

const m = messages.club.join;

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    redeemCode,
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <Field label={m.code}>
        <Input
          name="code"
          required
          autoComplete="off"
          spellCheck={false}
          defaultValue={code}
          placeholder={m.placeholder}
          maxLength={20}
        />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {m.submit}
      </Button>
    </form>
  );
}
