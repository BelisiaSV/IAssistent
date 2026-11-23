"use client";

import { CLUB_DOCUMENTS_BUCKET } from "@iassistent/db";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import type { FormState } from "@/lib/clubs/form-state";
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES } from "@/lib/clubs/knowledge";
import { addComment, prepareDocumentUpload, saveDocument, shareTraining } from "@/lib/clubs/knowledge-actions";
import { messages } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const m = messages.club.knowledge;
const area = "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";

/** Upload a document straight to storage, then store its details (owner, admin, technical director). */
export function DocumentUploadForm({ clubId }: { clubId: string }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > DOCUMENT_MAX_BYTES || !DOCUMENT_TYPES.includes(file.type)) {
      setState({ error: m.errors.file });
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareDocumentUpload(clubId, { name: file.name, type: file.type, size: file.size });
      if ("error" in prepared) return setState({ error: prepared.error });
      const { error } = await createBrowserSupabase()
        .storage.from(CLUB_DOCUMENTS_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (error) return setState({ error: m.errors.failed });
      const result = await saveDocument(
        clubId,
        { path: prepared.path, documentId: prepared.documentId, fileName: file.name, size: file.size },
        {
          title: String(data.get("title") ?? ""),
          kind: String(data.get("kind") ?? "document"),
          description: String(data.get("description") ?? ""),
          categories: data.getAll("categories").map(String),
        },
      );
      setState(result);
      if (!result.error) {
        form.reset();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field label={m.title}>
          <Input name="title" required maxLength={120} />
        </Field>
        <Field label={m.kind}>
          <select name="kind" defaultValue="guideline" className={area}>
            {Object.entries(m.kinds).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={m.description}>
        <textarea name="description" rows={2} maxLength={600} className={area} />
      </Field>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{m.categories}</legend>
        <div className="flex flex-wrap gap-1.5">
          {AGE_CATEGORIES.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
              <input type="checkbox" name="categories" value={c} />
              {(messages.ageCategories as Record<string, string>)[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={m.file}>
        <input type="file" name="file" required accept={DOCUMENT_TYPES.join(",")} className="block w-full text-sm" />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={busy}>
        {busy ? m.uploading : m.upload}
      </Button>
    </form>
  );
}

/** Feedback of a trainer on a shared training. */
export function CommentForm({ clubId, trainingId }: { clubId: string; trainingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addComment.bind(null, clubId, trainingId), {});
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <textarea name="body" required rows={2} maxLength={1000} placeholder={m.comment} className={`${area} min-w-0 flex-1`} />
      <Button type="submit" disabled={pending}>
        {m.send}
      </Button>
      {state.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}

/** Share a training day of the approved week document with the club. */
export function ShareTrainingForm({
  teamId,
  runId,
  clubName,
  days,
}: {
  teamId: string;
  runId: string;
  clubName: string;
  days: { datum: string; label: string; shared: boolean }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(shareTraining.bind(null, teamId, runId), {});
  const open = days.filter((d) => !d.shared);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-600">{m.share.intro(clubName)}</p>
      <Field label={m.share.day}>
        <select name="date" required className={area} defaultValue={open[0]?.datum ?? ""}>
          {days.map((d) => (
            <option key={d.datum} value={d.datum} disabled={d.shared}>
              {d.label}
              {d.shared ? ` (${m.share.already})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label={m.share.note}>
        <textarea name="note" rows={2} maxLength={600} className={area} />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Button type="submit" disabled={pending || !open.length}>
        {m.share.submit}
      </Button>
    </form>
  );
}
