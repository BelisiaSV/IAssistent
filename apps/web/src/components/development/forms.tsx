"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { saveTeamGoal, savePlayerGoal, saveTrainingEvaluation } from "@/lib/development/actions";
import type { FormState } from "@/lib/clubs/form-state";
import { messages } from "@/lib/messages";

const m = messages.development;
const STATUSES = ["open", "on_track", "at_risk", "achieved", "dropped"] as const;
const area = "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";

function Result({ state }: { state: FormState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

/** Evaluate one training: rating, what went well, what to improve, attention points (from /staff). */
export function EvaluationForm({
  teamId,
  date,
  initial,
  scale,
  points,
}: {
  teamId: string;
  date: string;
  initial: { rating: number | null; went_well: string | null; to_improve: string | null; attention_points: string[] } | null;
  scale: { value: number; label: string }[];
  points: { code: string; naam: string; uitleg?: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTrainingEvaluation.bind(null, teamId, date), {});
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{m.rating}</legend>
        <div className="flex flex-wrap gap-1.5">
          {scale.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
              <input type="radio" name="rating" value={s.value} defaultChecked={initial?.rating === s.value} />
              {s.value} · {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={m.wentWell}>
        <textarea name="wentWell" rows={2} maxLength={1000} defaultValue={initial?.went_well ?? ""} className={area} />
      </Field>
      <Field label={m.toImprove}>
        <textarea name="toImprove" rows={2} maxLength={1000} defaultValue={initial?.to_improve ?? ""} className={area} />
      </Field>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{m.attentionPoints}</legend>
        <div className="flex flex-wrap gap-1.5">
          {points.map((p) => (
            <label key={p.code} title={p.uitleg} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
              <input type="checkbox" name="points" value={p.code} defaultChecked={initial?.attention_points.includes(p.code)} />
              {p.naam}
            </label>
          ))}
        </div>
      </fieldset>
      <Result state={state} />
      <Button type="submit" disabled={pending}>
        {m.save}
      </Button>
    </form>
  );
}

export interface GoalValues {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  progress: number;
  player_id?: string;
}

/** A team goal, or with `players` a development goal of a player. */
export function GoalForm({
  teamId,
  goal,
  players,
}: {
  teamId: string;
  goal: GoalValues | null;
  players?: { id: string; label: string }[];
}) {
  const save = players ? savePlayerGoal : saveTeamGoal;
  const [state, action, pending] = useActionState<FormState, FormData>(save.bind(null, teamId, goal?.id ?? null), {});
  return (
    <form action={action} className="space-y-4">
      {players && (
        <Field label={m.player}>
          <select name="playerId" required defaultValue={goal?.player_id ?? ""} className={area}>
            <option value="" disabled>
              —
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={m.title}>
        <Input name="title" required maxLength={120} defaultValue={goal?.title ?? ""} />
      </Field>
      <Field label={players ? m.note : m.description}>
        <textarea name="description" rows={2} maxLength={1000} defaultValue={goal?.description ?? ""} className={area} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={m.status}>
          <select name="status" defaultValue={goal?.status ?? "open"} className={area}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {m.statuses[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={m.progress}>
          <Input type="number" name="progress" min={0} max={100} step={5} defaultValue={goal?.progress ?? 0} />
        </Field>
        <Field label={m.targetDate}>
          <Input type="date" name="targetDate" defaultValue={goal?.target_date ?? ""} />
        </Field>
      </div>
      <Result state={state} />
      <Button type="submit" disabled={pending}>
        {m.save}
      </Button>
    </form>
  );
}
