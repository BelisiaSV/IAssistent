"use client";

import { BANK_MEDIA_BUCKET } from "@iassistent/db";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BankMedia } from "@/components/exercise-bank/bank-media";
import { messages } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import { prepareExerciseMediaUpload, saveExerciseMedia } from "../../actions";

const m = messages.exerciseBank.admin;

/** The drawing or video of one exercise: see it, replace it or remove it. */
export function ExerciseMediaForm({ number, kind, url }: { number: string; kind: string | null; url: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareExerciseMediaUpload(number, { type: file.type, size: file.size });
      if ("error" in prepared) return setError(prepared.error);
      const { error: uploadError } = await createBrowserSupabase()
        .storage.from(BANK_MEDIA_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (uploadError) return setError(m.errors.media);
      const saved = await saveExerciseMedia(number, prepared.path);
      if (saved.error) return setError(saved.error);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const saved = await saveExerciseMedia(number, null);
    setBusy(false);
    if (saved.error) setError(saved.error);
    else router.refresh();
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">{m.mediaEditTitle}</h2>
      {url ? <BankMedia kind={kind} url={url} alt={number} className="max-h-80 max-w-xl" /> : <p className="text-sm text-slate-500">{m.mediaNone}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? m.mediaUploading : url ? m.mediaReplace : m.mediaAdd}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="sr-only"
            disabled={busy}
            onChange={(event) => upload(event.target.files?.[0])}
          />
        </label>
        {url && (
          <button type="button" disabled={busy} onClick={remove} className="text-sm text-slate-600 hover:text-red-700 hover:underline disabled:opacity-50">
            {m.mediaRemove}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
