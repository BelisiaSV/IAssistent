"use client";

import {
  type FormationCatalog,
  maxLength,
  visionAnswerKey,
  type VisionAnswer,
  type VisionAnswers,
  type VisionQuestion,
  type VisionQuestionnaire,
} from "@iassistent/staff-engine/content";
import { type FormEvent, startTransition, useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { saveVision, type VisionFormState } from "./actions";

const m = messages.vision;
const textareaClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none";
const pillClass =
  "flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand/10 has-checked:font-medium";

export function VisionForm({
  questionnaire,
  formations,
  summary,
  answers,
  initialAnswered,
}: {
  questionnaire: VisionQuestionnaire;
  formations: FormationCatalog;
  summary: string;
  answers: VisionAnswers;
  initialAnswered: number;
}) {
  const [state, action, pending] = useActionState<VisionFormState, FormData>(saveVision, {});
  const total = questionnaire.themas.reduce((n, t) => n + t.vragen.length, 0);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <Field label={m.summary} hint={m.summaryHint} error={state.summaryError}>
          <textarea name="summary" rows={4} maxLength={2000} defaultValue={summary} className={textareaClass} />
        </Field>
        <p className="text-xs text-slate-500">{m.progress(initialAnswered, total)}</p>
      </section>

      {questionnaire.themas.map((theme) => (
        <section key={theme.id} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div>
            <h2 className="text-lg font-semibold">{theme.titel}</h2>
            {theme.uitleg && <p className="text-sm text-slate-600">{theme.uitleg}</p>}
          </div>
          {theme.vragen.map((question) => {
            const key = visionAnswerKey(theme.id, question.id);
            const error = state.errors?.[key];
            return (
              <div key={key} className="space-y-2">
                <p className="text-sm font-medium text-slate-800">{question.vraag}</p>
                {question.uitleg && <p className="text-xs text-slate-500">{question.uitleg}</p>}
                <QuestionInput name={key} question={question} value={answers[key]} formations={formations} />
                {error && <p className="text-xs text-red-600">{m.errors[error]}</p>}
              </div>
            );
          })}
        </section>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" disabled={pending} className="shadow-lg">
          {pending ? messages.common.saving : messages.common.save}
        </Button>
      </div>
    </form>
  );
}

function asArray(value: VisionAnswer | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [String(value)];
}

function QuestionInput({
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
      return <Input name={name} maxLength={maxLength(question)!} defaultValue={current[0] ?? ""} />;
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
      return <Choices name={name} options={question.opties.map((o) => [o, o])} current={current} />;
    case "meerkeuze":
      return <Choices name={name} options={question.opties.map((o) => [o, o])} current={current} multiple />;
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
      const steps = Array.from({ length: question.max - question.min + 1 }, (_, i) => question.min + i);
      return (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <label className={pillClass}>
              <input type="radio" name={name} value="" defaultChecked={current.length === 0} className="sr-only" />
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
              {question.min} = {question.label_min} · {question.max} = {question.label_max}
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
          <input type="radio" name={name} value="" defaultChecked={current.length === 0} className="sr-only" />
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
