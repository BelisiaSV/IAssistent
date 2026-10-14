"use client";

import { useActionState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type FormState, saveMatchReport } from "../actions";

const m = messages.matchReport;
const inputClass = "block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50";

export type MatchReportValues = {
  goalsFor: number | null;
  goalsAgainst: number | null;
  ownFormation: string | null;
  opponentFormation: string | null;
  wentWell: string | null;
  wentBadly: string | null;
  lessons: string | null;
};

/** Findings of the head coach after one match of the week. */
export function MatchReportForm({
  teamId,
  weekStart,
  match,
  initial,
  formations,
  canEdit,
}: {
  teamId: string;
  weekStart: string;
  match: { date: string; label: string };
  initial: MatchReportValues | null;
  formations: { code: string; name: string }[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveMatchReport.bind(null, teamId, weekStart, match.date),
    {},
  );

  const formationSelect = (name: string, label: string, value: string | null) => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select name={name} defaultValue={value ?? ""} disabled={!canEdit} className={inputClass}>
        <option value="">{m.choose}</option>
        {formations.map((f) => (
          <option key={f.code} value={f.code}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
  const text = (name: string, label: string, value: string | null) => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea name={name} defaultValue={value ?? ""} rows={3} maxLength={2000} disabled={!canEdit} className={inputClass} />
    </label>
  );

  return (
    <form action={action} className="space-y-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
      <p className="text-sm font-medium">{match.label}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium text-slate-700">{m.score}</legend>
          <div className="flex items-center gap-2">
            <input name="goalsFor" type="number" min={0} max={50} aria-label={m.us} placeholder={m.us} defaultValue={initial?.goalsFor ?? ""} disabled={!canEdit} className={`w-20 ${inputClass}`} />
            <span>–</span>
            <input name="goalsAgainst" type="number" min={0} max={50} aria-label={m.them} placeholder={m.them} defaultValue={initial?.goalsAgainst ?? ""} disabled={!canEdit} className={`w-20 ${inputClass}`} />
          </div>
        </fieldset>
        {formationSelect("ownFormation", m.ownFormation, initial?.ownFormation ?? null)}
        {formationSelect("opponentFormation", m.opponentFormation, initial?.opponentFormation ?? null)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {text("wentWell", m.wentWell, initial?.wentWell ?? null)}
        {text("wentBadly", m.wentBadly, initial?.wentBadly ?? null)}
        {text("lessons", m.lessons, initial?.lessons ?? null)}
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : messages.common.save}
          </Button>
        </div>
      )}
    </form>
  );
}
