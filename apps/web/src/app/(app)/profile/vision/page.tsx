import { visionAnswerKey, type VisionAnswers } from "@iassistent/staff-engine/content";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { formationCatalog, visionQuestionnaire } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { VisionForm } from "./vision-form";

export default async function VisionPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("coach_profiles")
    .select("vision_summary, vision")
    .eq("coach_id", user.id)
    .maybeSingle();

  const stored = (profile?.vision ?? {}) as { antwoorden?: VisionAnswers };
  const answers = stored.antwoorden ?? {};
  const keys = visionQuestionnaire.themas.flatMap((t) => t.vragen.map((v) => visionAnswerKey(t.id, v.id)));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{messages.vision.title}</h1>
        <p className="text-sm text-slate-600">{messages.vision.intro}</p>
        <p className="text-xs text-slate-500">{messages.vision.private}</p>
      </div>
      <VisionForm
        questionnaire={visionQuestionnaire}
        formations={formationCatalog}
        summary={profile?.vision_summary ?? ""}
        answers={answers}
        initialAnswered={keys.filter((k) => answers[k] !== undefined).length}
      />
    </div>
  );
}
