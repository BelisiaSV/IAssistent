"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { BANK_TEXT_MAX, type BankParseResult, parseBankText } from "@/lib/exercise-bank/import";
import { bankMediaFiles, readBankZip } from "@/lib/exercise-bank/zip";
import { messages } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import { type BankImportResult, importBank } from "./actions";
import { uploadBankMediaFile } from "./upload-media";

const m = messages.exerciseBank.admin;

/**
 * Upload of an export of the exercise database: a backup (.json) or a zip
 * with the backup and all drawings and videos. Checked in the browser first,
 * then the exercises are imported and the files linked by their code.
 */
export function BankImport({ existing }: { existing: string[] }) {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [media, setMedia] = useState<File[]>([]);
  const [preview, setPreview] = useState<BankParseResult | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BankImportResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setProgress(null);
    setReading(true);
    try {
      const fromZip = file.name.toLowerCase().endsWith(".zip") ? await readBankZip(file) : null;
      const content = fromZip ? fromZip.text : file.size <= BANK_TEXT_MAX ? await file.text() : null;
      const parsed = content ? parseBankText(content) : null;
      setUnreadable(!parsed);
      setPreview(parsed);
      setText(parsed ? content : null);
      // Only the pictures of exercises in the backup, named after their code.
      setMedia(parsed && fromZip ? bankMediaFiles(parsed.exercises, fromZip.media) : []);
    } catch {
      setUnreadable(true);
      setPreview(null);
    } finally {
      setReading(false);
    }
  }

  async function run() {
    if (!text) return;
    setBusy(true);
    try {
      const outcome = await importBank(text);
      setResult(outcome);
      if (!outcome.counts) return;
      if (media.length) {
        const supabase = createBrowserSupabase();
        const state = { done: 0, failed: 0, total: media.length };
        setProgress({ ...state });
        // One at a time: videos are large.
        for (const file of media) {
          const saved = await uploadBankMediaFile(supabase, file);
          if ("error" in saved) state.failed += 1;
          else state.done += 1;
          setProgress({ ...state });
        }
      }
      setPreview(null);
      setText(null);
      setMedia([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const known = new Set(existing);
  const added = preview?.exercises.filter((x) => !known.has(x.number)).length ?? 0;

  return (
    <section className="space-y-3">
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark ${reading || busy ? "pointer-events-none opacity-50" : ""}`}
      >
        {reading ? m.reading : m.file}
        <input
          type="file"
          accept=".json,.zip,application/json,application/zip"
          className="sr-only"
          disabled={reading || busy}
          onChange={(event) => read(event.target.files?.[0])}
        />
      </label>
      {unreadable && <Alert tone="error">{m.unreadable}</Alert>}
      {preview && (
        <div className="space-y-2">
          <h2 className="font-semibold">{m.previewTitle}</h2>
          <p className="text-sm">{m.summary(preview.exercises.length, added, preview.exercises.length - added)}</p>
          {media.length > 0 && <p className="text-sm">{m.zipMedia(media.length)}</p>}
          {preview.uncertain.length > 0 && <p className="text-sm text-amber-700">{m.uncertainNote(preview.uncertain.length)}</p>}
          {preview.issues.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
              <p className="font-medium">{m.issuesTitle(preview.issues.length)}</p>
              <ul className="mt-1 list-disc pl-5">
                {preview.issues.map((issue) => (
                  <li key={issue.position}>
                    {issue.label}: {m.issue(issue.field, !!issue.duplicate)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button disabled={busy || !text || preview.exercises.length === 0} onClick={run}>
            {busy ? m.importing : m.import}
          </Button>
        </div>
      )}
      {result?.error && <Alert tone="error">{result.error}</Alert>}
      {result?.counts && <Alert tone="success">{m.done(result.counts)}</Alert>}
      {progress && (
        <p className={`text-sm ${progress.failed ? "text-amber-700" : "text-slate-600"}`}>
          {m.zipProgress(progress.done, progress.failed, progress.total)}
        </p>
      )}
    </section>
  );
}
