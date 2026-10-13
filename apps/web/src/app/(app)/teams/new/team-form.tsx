"use client";

import { TEAM_LOGO_MIME_TYPES } from "@iassistent/db";
import Link from "next/link";
import { type FormEvent, startTransition, useActionState, useEffect, useState } from "react";

import { TeamCard } from "@/components/team-card";
import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { createTeam, type TeamFormState } from "../actions";

const m = messages.teamForm;

export function TeamForm() {
  const [state, action, pending] = useActionState<TeamFormState, FormData>(createTeam, {});
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [clubName, setClubName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1F4E79");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  // Submit manually so React does not reset the form (and the chosen logo) on errors.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Field label={m.clubName} error={errors.clubName}>
        <Input
          name="clubName"
          required
          maxLength={120}
          placeholder={m.clubNamePlaceholder}
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={m.name} error={errors.name}>
          <Input
            name="name"
            required
            maxLength={120}
            placeholder={m.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={m.season} error={errors.season}>
          <Input
            name="season"
            maxLength={20}
            placeholder={m.seasonPlaceholder}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={m.primaryColor} error={errors.primaryColor}>
          <input
            name="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-slate-300"
          />
        </Field>
        <Field label={m.secondaryColor} error={errors.secondaryColor}>
          <input
            name="secondaryColor"
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-slate-300"
          />
        </Field>
      </div>

      <Field label={m.logo} hint={m.logoHint} error={errors.logo}>
        <input
          name="logo"
          type="file"
          accept={TEAM_LOGO_MIME_TYPES.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            setLogoPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">{m.preview}</p>
        <ul>
          <TeamCard
            name={name || m.namePlaceholder}
            season={season || null}
            clubName={clubName || m.clubNamePlaceholder}
            logoUrl={logoPreview}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
        </ul>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/teams" className="text-sm text-slate-600 hover:text-brand">
          {m.cancel}
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </Button>
      </div>
    </form>
  );
}
