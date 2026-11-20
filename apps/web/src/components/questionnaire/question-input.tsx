"use client";

import {
  type FormationCatalog,
  maxLength,
  type VisionAnswer,
  type VisionQuestion,
} from "@iassistent/staff-engine/content";

import { Input } from "@/components/ui";
import { messages } from "@/lib/messages";

const m = messages.vision;
export const textareaClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none";
export const pillClass =
  "flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand/10 has-checked:font-medium";

function asArray(value: VisionAnswer | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [String(value)];
}

/** The input of one questionnaire question (vision profile, club DNA). */
export function QuestionInput({
  name,
  question,
  value,
  formations,
}: {
  name: string;
  question: VisionQuestion;
  value: VisionAnswer | undefined;
  formations: FormationCatalog;
}) {
  const current = asArray(value);

  switch (question.type) {
    case "kort_antwoord":
      return (
        <Input
          name={name}
          maxLength={maxLength(question)!}
          defaultValue={current[0] ?? ""}
        />
      );
    case "tekst":
      return (
        <textarea
          name={name}
          rows={3}
          maxLength={maxLength(question)!}
          defaultValue={current[0] ?? ""}
          className={textareaClass}
        />
      );
    case "keuze":
      return (
        <Choices
          name={name}
          options={question.opties.map((o) => [o, o])}
          current={current}
        />
      );
    case "meerkeuze":
      return (
        <Choices
          name={name}
          options={question.opties.map((o) => [o, o])}
          current={current}
          multiple
        />
      );
    case "formatie":
      return (
        <Choices
          name={name}
          options={formations.formaties.map((f) => [f.code, f.naam])}
          current={current}
          multiple={question.meerdere === true}
        />
      );
    case "schaal": {
      const steps = Array.from(
        { length: question.max - question.min + 1 },
        (_, i) => question.min + i,
      );
      return (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <label className={pillClass}>
              <input
                type="radio"
                name={name}
                value=""
                defaultChecked={current.length === 0}
                className="sr-only"
              />
              {m.notDecided}
            </label>
            {steps.map((n) => (
              <label key={n} className={`${pillClass} w-10 justify-center`}>
                <input
                  type="radio"
                  name={name}
                  value={n}
                  defaultChecked={current[0] === String(n)}
                  className="sr-only"
                />
                {n}
              </label>
            ))}
          </div>
          {(question.label_min || question.label_max) && (
            <p className="text-xs text-slate-500">
              {question.min} = {question.label_min} · {question.max} ={" "}
              {question.label_max}
            </p>
          )}
        </div>
      );
    }
  }
}

function Choices({
  name,
  options,
  current,
  multiple = false,
}: {
  name: string;
  options: [value: string, label: string][];
  current: string[];
  multiple?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!multiple && (
        <label className={pillClass}>
          <input
            type="radio"
            name={name}
            value=""
            defaultChecked={current.length === 0}
            className="sr-only"
          />
          {m.notDecided}
        </label>
      )}
      {options.map(([value, label]) => (
        <label key={value} className={pillClass}>
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={value}
            defaultChecked={current.includes(value)}
            className={multiple ? "accent-brand" : "sr-only"}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
