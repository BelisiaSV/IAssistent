"use client";

import { TEAM_MEDIA_BUCKET } from "@iassistent/db";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { messages } from "@/lib/messages";
import { prepareTeamPhotoUpload, saveTeamPhoto } from "@/lib/presentation/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const m = messages.presentation.media;

/** Cover photo and team photo for the match presentation (uploaded straight from the browser). */
export function TeamPhotosForm({
  teamId,
  photos,
  canEdit,
}: {
  teamId: string;
  photos: { cover: string | null; team: string | null };
  canEdit: boolean;
}) {
  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoField teamId={teamId} kind="cover" label={m.cover} url={photos.cover} canEdit={canEdit} />
        <PhotoField teamId={teamId} kind="team" label={m.team} url={photos.team} canEdit={canEdit} />
      </div>
    </section>
  );
}

function PhotoField({ teamId, kind, label, url, canEdit }: { teamId: string; kind: "cover" | "team"; label: string; url: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const prepared = await prepareTeamPhotoUpload(teamId, kind, { type: file.type, size: file.size });
    if ("error" in prepared) {
      setError(prepared.error);
      setBusy(false);
      return;
    }
    const { error: uploadError } = await createBrowserSupabase()
      .storage.from(TEAM_MEDIA_BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
    const result = uploadError ? { error: messages.presentation.errors.photo } : await saveTeamPhoto(teamId, kind, prepared.path);
    if (result.error) setError(result.error);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await saveTeamPhoto(teamId, kind, null);
    if (result.error) setError(result.error);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-slate-500">{m.none}</span>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
            {busy ? m.uploading : m.choose}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
          {url && (
            <button type="button" onClick={remove} disabled={busy} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              {m.remove}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
