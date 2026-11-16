"use client";

import { useState, useTransition } from "react";

import { messages } from "@/lib/messages";
import { uploadOpponentLogo } from "@/lib/presentation/actions";

const m = messages.presentation;

/** Logos the presentation needs: the opponent and its last five opponents. */
export function LogoManager({ teamId, teams, canEdit }: { teamId: string; teams: { name: string; logoUrl: string | null }[]; canEdit: boolean }) {
  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 print:hidden">
      <div>
        <h2 className="font-semibold">{m.logosTitle}</h2>
        <p className="text-sm text-slate-600">{m.logosIntro}</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => (
          <LogoRow key={t.name} teamId={teamId} name={t.name} url={t.logoUrl} canEdit={canEdit} />
        ))}
      </ul>
    </section>
  );
}

function LogoRow({ teamId, name, url, canEdit }: { teamId: string; name: string; url: string | null; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex items-center gap-3 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-10 w-10 rounded bg-white object-contain" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded bg-slate-200 text-xs text-slate-500">?</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        {!url && <span className="block text-xs text-slate-500">{m.logoMissing}</span>}
        {error && <span className="block text-xs text-red-700">{error}</span>}
      </span>
      {canEdit && (
        <label className="cursor-pointer rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
          {pending ? m.uploading : url ? m.logoReplace : m.logoUpload}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.set("logo", file);
              setError(null);
              startTransition(async () => {
                const result = await uploadOpponentLogo(teamId, name, form);
                if (result.error) setError(result.error);
              });
            }}
          />
        </label>
      )}
    </li>
  );
}
