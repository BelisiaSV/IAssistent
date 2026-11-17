"use client";

import { useState, useTransition } from "react";

import { messages } from "@/lib/messages";
import { savePrinciple } from "@/lib/presentation/actions";
import type { PresentationData } from "@/lib/presentation/types";

const m = messages.presentation;

/** The head coach rewrites the principle of the week for the slides. */
export function PrincipleEditor({
  teamId,
  principle,
  edit,
}: {
  teamId: string;
  principle: PresentationData["principle"];
  edit: NonNullable<PresentationData["principleEdit"]>;
}) {
  const [title, setTitle] = useState(principle?.title ?? "");
  const [explanation, setExplanation] = useState(principle?.explanation ?? "");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({});

  function save(value: { titel: string; uitleg: string } | null) {
    startTransition(async () => {
      const result = await savePrinciple(teamId, edit.weekPlanId, value);
      setState(result.error ? { error: result.error } : { saved: true });
      if (!result.error && value === null) {
        setTitle(edit.original?.title ?? "");
        setExplanation(edit.original?.explanation ?? "");
      }
    });
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 print:hidden">
      <div>
        <h2 className="font-semibold">{m.principleTitle}</h2>
        <p className="text-sm text-slate-600">{m.principleIntro}</p>
        {edit.custom && edit.original && <p className="mt-1 text-xs text-slate-500">{m.principleFromCoach(edit.original.title)}</p>}
      </div>
      <label className="block text-sm font-medium">
        {m.principleName}
        <input
          value={title}
          maxLength={120}
          onChange={(event) => {
            setTitle(event.target.value);
            setState({});
          }}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        {m.principleExplanation}
        <textarea
          value={explanation}
          maxLength={600}
          rows={3}
          onChange={(event) => {
            setExplanation(event.target.value);
            setState({});
          }}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={() => save({ titel: title, uitleg: explanation })}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {m.principleSave}
        </button>
        {edit.custom && (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(null)}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-50"
          >
            {m.principleReset}
          </button>
        )}
        {edit.custom && !state.saved && <span className="text-xs text-slate-500">{m.principleCustom}</span>}
        {state.saved && <span className="text-sm text-green-700">{m.principleSaved}</span>}
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </section>
  );
}
