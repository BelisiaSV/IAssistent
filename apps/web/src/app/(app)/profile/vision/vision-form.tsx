"use client";

import {
  type FormationCatalog,
  visionAnswerKey,
  type VisionAnswers,
  type VisionQuestionnaire,
} from "@iassistent/staff-engine/content";
import { type FormEvent, startTransition, useActionState } from "react";

import {
  QuestionInput,
  textareaClass,
} from "@/components/questionnaire/question-input";
import { Alert, Button, Field } from "@/components/ui";
import { messages } from "@/lib/messages";

import { saveVision, type VisionFormState } from "./actions";

const m = messages.vision;

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
  const [state, action, pending] = useActionState<VisionFormState, FormData>(
    saveVision,
    {},
  );
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
        <Field
          label={m.summary}
          hint={m.summaryHint}
          error={state.summaryError}
        >
          <textarea
            name="summary"
            rows={4}
            maxLength={2000}
            defaultValue={summary}
            className={textareaClass}
          />
        </Field>
        <p className="text-xs text-slate-500">
          {m.progress(initialAnswered, total)}
        </p>
      </section>

      {questionnaire.themas.map((theme) => (
        <section
          key={theme.id}
          className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div>
            <h2 className="text-lg font-semibold">{theme.titel}</h2>
            {theme.uitleg && (
              <p className="text-sm text-slate-600">{theme.uitleg}</p>
            )}
          </div>
          {theme.vragen.map((question) => {
            const key = visionAnswerKey(theme.id, question.id);
            const error = state.errors?.[key];
            return (
              <div key={key} className="space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  {question.vraag}
                </p>
                {question.uitleg && (
                  <p className="text-xs text-slate-500">{question.uitleg}</p>
                )}
                <QuestionInput
                  name={key}
                  question={question}
                  value={answers[key]}
                  formations={formations}
                />
                {error && (
                  <p className="text-xs text-red-600">{m.errors[error]}</p>
                )}
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
