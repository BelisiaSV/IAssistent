"use client";

import { ZonePicker } from "@/components/exercise-bank/zone-picker";
import { FORM_FIELDS } from "@/lib/exercise-bank/form";
import { messages } from "@/lib/messages";

const m = messages.exerciseBank.admin;
const fields = messages.exerciseBank.fields;

/** The fields of an exercise in the bank's shape, with the zones (bank corrections and club exercises). */
export function ContentFields({
  initial,
  zones,
}: {
  initial: Record<string, string>;
  zones: number[];
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {FORM_FIELDS.map(([key, kind]) => {
          const label = m.editLabels[key] ?? fields[key] ?? key;
          const wide = kind !== "text";
          const className =
            "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
          return (
            <label
              key={key}
              className={`block text-sm font-medium ${wide ? "md:col-span-2" : ""}`}
            >
              {label}
              {kind === "lines" && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {m.editHints.lines}
                </span>
              )}
              {kind === "tags" && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {m.editHints.tags}
                </span>
              )}
              {kind === "text" || kind === "tags" ? (
                <input
                  name={key}
                  defaultValue={initial[key]}
                  required={key === "titel" || key === "type"}
                  className={className}
                />
              ) : (
                <textarea
                  name={key}
                  defaultValue={initial[key]}
                  rows={kind === "lines" ? 4 : 3}
                  className={className}
                />
              )}
            </label>
          );
        })}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {messages.exerciseBank.zonesTitle}
          <span className="ml-2 text-xs font-normal text-slate-500">
            {m.zonesHint}
          </span>
        </p>
        <ZonePicker name="zones" initial={zones} />
      </div>
    </>
  );
}
