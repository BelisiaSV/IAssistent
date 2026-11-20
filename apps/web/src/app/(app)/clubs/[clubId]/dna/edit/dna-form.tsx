"use client";

import {
  type ClubDnaContent,
  type ClubDnaQuestionnaire,
  type FormationCatalog,
  visionAnswerKey,
} from "@iassistent/staff-engine/content";
import { type FormEvent, startTransition, useActionState } from "react";

import {
  QuestionInput,
  textareaClass,
} from "@/components/questionnaire/question-input";
import { Alert, Button, Field } from "@/components/ui";
import {
  type DnaFormState,
  publishDna,
  saveDnaDraft,
} from "@/lib/clubs/dna-actions";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const m = messages.club.dna;
const categories = messages.ageCategories as Record<string, string>;

/** Edit the draft of the club's DNA: answers with a level, the summary and the goals per age category. */
export function DnaForm({
  clubId,
  questionnaire,
  formations,
  content,
  canPublish,
  hasDraft,
}: {
  clubId: string;
  questionnaire: ClubDnaQuestionnaire;
  formations: FormationCatalog;
  content: ClubDnaContent;
  canPublish: boolean;
  hasDraft: boolean;
}) {
  const [state, action, pending] = useActionState<DnaFormState, FormData>(
    saveDnaDraft.bind(null, clubId),
    {},
  );
  const [published, publish, publishing] = useActionState<
    DnaFormState,
    FormData
  >(publishDna.bind(null, clubId), {});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.ok && <Alert tone="success">{state.ok}</Alert>}

        <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <Field label={m.summary} hint={m.summaryHint}>
            <textarea
              name="summary"
              rows={4}
              maxLength={2000}
              defaultValue={content.samenvatting ?? ""}
              className={textareaClass}
            />
          </Field>
          <p className="text-xs text-slate-500">{m.levelHint}</p>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      {question.vraag}
                    </p>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      {m.levelLabel}
                      <select
                        name={`niveau:${key}`}
                        defaultValue={content.niveaus[key] ?? "aanbevolen"}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="verplicht">{m.verplicht}</option>
                        <option value="aanbevolen">{m.aanbevolen}</option>
                      </select>
                    </label>
                  </div>
                  {question.uitleg && (
                    <p className="text-xs text-slate-500">{question.uitleg}</p>
                  )}
                  <QuestionInput
                    name={key}
                    question={question}
                    value={content.antwoorden[key]}
                    formations={formations}
                  />
                  {error && (
                    <p className="text-xs text-red-600">
                      {messages.vision.errors[error]}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        <section className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div>
            <h2 className="text-lg font-semibold">
              {questionnaire.leeftijdsdoelen.titel}
            </h2>
            {questionnaire.leeftijdsdoelen.uitleg && (
              <p className="text-sm text-slate-600">
                {questionnaire.leeftijdsdoelen.uitleg}
              </p>
            )}
          </div>
          {AGE_CATEGORIES.map((category) => (
            <details
              key={category}
              className="rounded-lg bg-slate-50 p-3"
              open={questionnaire.leeftijdsdoelen.vragen.some(
                (v) =>
                  content.leeftijdsdoelen[visionAnswerKey(category, v.id)] !==
                  undefined,
              )}
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {categories[category] ?? category}
              </summary>
              <div className="mt-3 space-y-3">
                {questionnaire.leeftijdsdoelen.vragen.map((question) => {
                  const key = visionAnswerKey(category, question.id);
                  const error = state.errors?.[`doel:${key}`];
                  return (
                    <div key={key} className="space-y-1.5">
                      <p className="text-sm font-medium text-slate-800">
                        {question.vraag}
                      </p>
                      <QuestionInput
                        name={`doel:${key}`}
                        question={question}
                        value={content.leeftijdsdoelen[key]}
                        formations={formations}
                      />
                      {error && (
                        <p className="text-xs text-red-600">
                          {messages.vision.errors[error]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </section>

        <div className="sticky bottom-4 flex justify-end">
          <Button type="submit" disabled={pending} className="shadow-lg">
            {pending ? messages.common.saving : m.saveDraft}
          </Button>
        </div>
      </form>

      {canPublish && (hasDraft || state.ok) && (
        <form
          action={publish}
          className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <h2 className="text-lg font-semibold">{m.publish}</h2>
          <p className="text-sm text-slate-600">{m.publishHint}</p>
          <Field label={m.note}>
            <input name="note" maxLength={300} className={textareaClass} />
          </Field>
          {published.error && <Alert tone="error">{published.error}</Alert>}
          {published.ok && <Alert tone="success">{published.ok}</Alert>}
          <Button
            type="submit"
            disabled={publishing}
            onClick={(ev) => {
              if (!confirm(m.publishConfirm)) ev.preventDefault();
            }}
          >
            {m.publish}
          </Button>
        </form>
      )}
    </div>
  );
}
