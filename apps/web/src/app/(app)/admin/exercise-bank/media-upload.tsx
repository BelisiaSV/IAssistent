"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { messages } from "@/lib/messages";
import { mediaKeyOf } from "@/lib/exercise-bank/zip";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import { uploadBankMediaFile } from "./upload-media";

const m = messages.exerciseBank.admin;

type Row = { name: string; state: "waiting" | "busy" | "done" | "error"; note: string };

/** The code of a file is its name without extension (as in the exercise database). */
const keyOf = mediaKeyOf;

/**
 * Uploads drawings and videos of the bank: each file goes straight to storage
 * (signed upload URL) and is linked to the exercises with that code.
 */
export function MediaUpload({ keys, missing }: { keys: string[]; missing: number }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const known = new Set(keys);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const initial: Row[] = list.map((f) => ({
      name: f.name,
      state: known.has(keyOf(f.name)) ? "waiting" : "error",
      note: known.has(keyOf(f.name)) ? "" : m.mediaUnknown,
    }));
    setRows(initial);
    setBusy(true);
    const set = (i: number, row: Partial<Row>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...row } : r)));
    const supabase = createBrowserSupabase();
    // One at a time: videos are large.
    for (const [i, file] of list.entries()) {
      if (initial[i]!.state === "error") continue;
      set(i, { state: "busy", note: m.mediaUploading });
      const saved = await uploadBankMediaFile(supabase, file);
      set(i, "error" in saved ? { state: "error", note: saved.error } : { state: "done", note: m.mediaDone(saved.linked) });
    }
    setBusy(false);
    router.refresh();
  }

  const done = rows.filter((r) => r.state === "done").length;
  const failed = rows.filter((r) => r.state === "error").length;
  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.mediaTitle}</h2>
        <p className="text-sm text-slate-600">{m.mediaIntro(missing, keys.length)}</p>
      </div>
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        {m.mediaChoose}
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="sr-only"
          disabled={busy}
          onChange={(event) => upload(event.target.files)}
        />
      </label>
      {rows.length > 0 && (
        <>
          {!busy && <p className="text-sm">{m.mediaSummary(done, failed)}</p>}
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {rows.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-4 shrink-0">{r.state === "done" ? "✓" : r.state === "error" ? "✗" : r.state === "busy" ? "…" : ""}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{r.name}</span>
                <span className={`text-xs ${r.state === "error" ? "text-red-700" : "text-slate-500"}`}>{r.note}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
