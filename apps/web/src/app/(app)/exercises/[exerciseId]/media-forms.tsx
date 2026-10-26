"use client";

import { EXERCISE_VIDEOS_BUCKET } from "@iassistent/db";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/exercises/validation";
import { messages } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import { attachVideo, type ExerciseFormState, importAnimation, prepareVideoUpload } from "../actions";

const m = messages.exercises.media;
const fileClass =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200";

export function AnimationImportForm({ exerciseId }: { exerciseId: string }) {
  const [state, action, pending] = useActionState<ExerciseFormState, FormData>(importAnimation.bind(null, exerciseId), {});
  return (
    <form action={action} className="space-y-2">
      <input name="file" type="file" accept="application/json,.json" required className={fileClass} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? messages.common.saving : m.animationImport}
      </Button>
    </form>
  );
}

/** Uploads the video straight to storage (signed upload URL), then links it to the exercise. */
export function VideoUploadForm({ exerciseId }: { exerciseId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ExerciseFormState>({});

  async function upload() {
    if (!file || !VIDEO_TYPES.includes(file.type as (typeof VIDEO_TYPES)[number]) || file.size > VIDEO_MAX_BYTES) {
      setState({ error: m.videoInvalid });
      return;
    }
    setBusy(true);
    setState({});
    try {
      const prepared = await prepareVideoUpload(exerciseId, { type: file.type, size: file.size });
      if ("error" in prepared) {
        setState({ error: prepared.error });
        return;
      }
      const { error } = await createBrowserSupabase()
        .storage.from(EXERCISE_VIDEOS_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (error) {
        setState({ error: messages.exercises.errors.saveFailed });
        return;
      }
      setState(await attachVideo(exerciseId, prepared.path));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept={VIDEO_TYPES.join(",")}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className={fileClass}
      />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Button type="button" variant="secondary" disabled={!file || busy} onClick={upload}>
        {busy ? m.videoUploading : m.videoUpload}
      </Button>
    </div>
  );
}

export function ConfirmButton({
  action,
  exerciseId,
  label,
  confirmText,
}: {
  action: (formData: FormData) => Promise<void>;
  exerciseId: string;
  label: string;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="exerciseId" value={exerciseId} />
      <button type="submit" className="text-sm text-red-700 hover:underline">
        {label}
      </button>
    </form>
  );
}
