"use client";

import { useActionState } from "react";

import { Alert, Button } from "@/components/ui";
import type { AnimationTheme } from "@/lib/animation/theme";
import { messages } from "@/lib/messages";

import { type FormState, saveAnimationSettings } from "./actions";

const m = messages.settings.display;
const selectClass = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50";

/** Style, colours and logo of animations for this team. */
export function DisplayForm({
  teamId,
  initial,
  theme,
  hasLogo,
  canEdit,
}: {
  teamId: string;
  initial: { stijl: "donker" | "licht"; logo_op_schijfjes: "geen" | "eigen" | "alle" };
  /** Current colours (settings or the defaults of the style). */
  theme: AnimationTheme;
  hasLogo: boolean;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAnimationSettings.bind(null, teamId), {});
  const colors: [string, string, string][] = [
    ["eigen", m.own, theme.teams.eigen],
    ["tegenstander", m.opponent, theme.teams.tegenstander],
    ["neutraal", m.neutral, theme.teams.neutraal],
    ["doelman_eigen", m.keeperOwn, theme.doelman.eigen ?? theme.teams.eigen],
    ["doelman_tegenstander", m.keeperOpponent, theme.doelman.tegenstander ?? theme.teams.tegenstander],
  ];
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-700">{m.style}</span>
          <select name="stijl" defaultValue={initial.stijl} disabled={!canEdit} className={selectClass}>
            {(["donker", "licht"] as const).map((v) => (
              <option key={v} value={v}>
                {m.styles[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">{m.logo}</span>
          <select name="logo_op_schijfjes" defaultValue={initial.logo_op_schijfjes} disabled={!canEdit} className={selectClass}>
            {(["geen", "eigen", "alle"] as const).map((v) => (
              <option key={v} value={v}>
                {m.logoOptions[v]}
              </option>
            ))}
          </select>
          {!hasLogo && <span className="mt-1 block text-xs text-slate-500">{m.logoMissing}</span>}
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {colors.map(([name, label, value]) => (
          <label key={name} className="text-xs text-slate-600">
            <span className="block">{label}</span>
            <input type="color" name={name} defaultValue={value} disabled={!canEdit} className="mt-1 h-10 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1" />
          </label>
        ))}
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {canEdit && (
        <div className="text-right">
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : messages.common.save}
          </Button>
        </div>
      )}
    </form>
  );
}
