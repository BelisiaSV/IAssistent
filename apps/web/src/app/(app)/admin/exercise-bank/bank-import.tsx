"use client";

import { useState, useTransition } from "react";

import { Alert, Button } from "@/components/ui";
import {
  BANK_TEXT_MAX,
  type BankParseResult,
  parseBankText,
} from "@/lib/exercise-bank/import";
import { messages } from "@/lib/messages";

import { type BankImportResult, importBank } from "./actions";

const m = messages.exerciseBank.admin;

/** Upload of the backup: checked in the browser first, imported on the server. */
export function BankImport({ existing }: { existing: string[] }) {
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<BankParseResult | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [result, setResult] = useState<BankImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function read(file: File | undefined) {
    if (!file) return;
    setResult(null);
    const content = file.size <= BANK_TEXT_MAX ? await file.text() : "";
    const parsed = content ? parseBankText(content) : null;
    setUnreadable(!parsed);
    setPreview(parsed);
    setText(parsed ? content : null);
  }

  const known = new Set(existing);
  const added =
    preview?.exercises.filter((x) => !known.has(x.number)).length ?? 0;

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
        {m.file}
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(event) => read(event.target.files?.[0])}
        />
      </label>
      {unreadable && <Alert tone="error">{m.unreadable}</Alert>}
      {preview && (
        <div className="space-y-2">
          <h2 className="font-semibold">{m.previewTitle}</h2>
          <p className="text-sm">
            {m.summary(
              preview.exercises.length,
              added,
              preview.exercises.length - added,
            )}
          </p>
          {preview.uncertain.length > 0 && (
            <p className="text-sm text-amber-700">
              {m.uncertainNote(preview.uncertain.length)}
            </p>
          )}
          {preview.issues.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
              <p className="font-medium">
                {m.issuesTitle(preview.issues.length)}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {preview.issues.map((issue) => (
                  <li key={issue.position}>
                    {issue.label}: {m.issue(issue.field, !!issue.duplicate)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            disabled={pending || !text || preview.exercises.length === 0}
            onClick={() =>
              startTransition(async () => {
                const outcome = await importBank(text!);
                setResult(outcome);
                if (outcome.counts) {
                  setPreview(null);
                  setText(null);
                }
              })
            }
          >
            {pending ? m.importing : m.import}
          </Button>
        </div>
      )}
      {result?.error && <Alert tone="error">{result.error}</Alert>}
      {result?.counts && <Alert tone="success">{m.done(result.counts)}</Alert>}
    </section>
  );
}
