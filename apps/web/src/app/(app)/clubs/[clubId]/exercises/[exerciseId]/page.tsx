import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/card";
import { BankFields } from "@/components/exercise-bank/bank-fields";
import { BankMedia } from "@/components/exercise-bank/bank-media";
import { ZoneMap } from "@/components/exercise-bank/zone-map";
import {
  setClubExerciseRecommended,
  setClubExerciseStatus,
  takeOverClubExercise,
} from "@/lib/clubs/exercise-actions";
import {
  CLUB_EXERCISE_COLUMNS,
  type ClubExerciseRow,
} from "@/lib/clubs/exercises";
import { getClubContext } from "@/lib/clubs/load";
import { bankZones } from "@/lib/exercise-bank/filters";
import { bankMediaUrls } from "@/lib/exercise-bank/load";
import { messages } from "@/lib/messages";

const m = messages.club.exercises;
const categories = messages.ageCategories as Record<string, string>;

function Action({
  clubId,
  id,
  name,
  value,
  label,
  action,
}: {
  clubId: string;
  id: string;
  name: string;
  value: string;
  label: string;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="exerciseId" value={id} />
      <input type="hidden" name={name} value={value} />
      <button
        type="submit"
        className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
      >
        {label}
      </button>
    </form>
  );
}

/** One club exercise: its content, origin and status; editors approve and recommend, every coach can take it over. */
export default async function ClubExercisePage({
  params,
}: {
  params: Promise<{ clubId: string; exerciseId: string }>;
}) {
  const { clubId, exerciseId } = await params;
  const ctx = await getClubContext(clubId);
  const { supabase } = ctx;
  const { data } = await supabase
    .from("club_exercises")
    .select(CLUB_EXERCISE_COLUMNS)
    .eq("id", exerciseId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (!data) notFound();
  const row = data as ClubExerciseRow;
  const editor = ctx.roles.some(
    (r) => r === "owner" || r === "admin" || r === "technical_director",
  );
  const canEdit =
    editor || (row.created_by === ctx.user.id && row.status === "proposed");
  const [{ data: own }, { data: author }, { data: base }] = await Promise.all([
    supabase
      .from("exercises")
      .select("id")
      .eq("bank_number", row.number)
      .maybeSingle(),
    row.created_by
      ? supabase
          .from("coaches")
          .select("full_name, email")
          .eq("id", row.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.base_bank_number
      ? supabase
          .from("bank_exercises")
          .select("number, media_kind, media_path")
          .eq("number", row.base_bank_number)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const mediaUrl = base?.media_path
    ? ((await bankMediaUrls(supabase, [base.media_path])).get(
        base.media_path,
      ) ?? null)
    : null;
  const zones = bankZones(row);

  return (
    <div className="max-w-4xl space-y-5">
      <Link
        href={`/clubs/${clubId}/exercises`}
        className="text-sm text-brand hover:underline"
      >
        {m.back}
      </Link>
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">{row.number}</span>
          <span>· {m.origin[row.origin]}</span>
          {author && <span>{m.by(author.full_name ?? author.email)}</span>}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
            {m.status[row.status]}
          </span>
          {row.recommended && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
              {m.recommended}
            </span>
          )}
        </p>
        <h2 className="text-2xl font-semibold">{row.title}</h2>
        <p className="text-sm text-slate-600">
          {[
            row.kind,
            row.phase,
            row.level,
            row.age_categories.map((a) => categories[a] ?? a).join(", "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {row.base_bank_number && (
          <Link
            href={`/exercises/bank/${row.base_bank_number}`}
            className="text-sm text-brand hover:underline"
          >
            {m.variantOf(row.base_bank_number)} →
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {own ? (
          <ButtonLink href={`/exercises/${own.id}`} subtle>
            {m.inLibrary}
          </ButtonLink>
        ) : (
          row.status === "approved" && (
            <form action={takeOverClubExercise}>
              <input type="hidden" name="exerciseId" value={row.id} />
              <button
                type="submit"
                className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                {m.takeOver}
              </button>
            </form>
          )
        )}
        {canEdit && (
          <ButtonLink href={`/clubs/${clubId}/exercises/${row.id}/edit`} subtle>
            {m.edit}
          </ButtonLink>
        )}
        {editor && row.status !== "approved" && (
          <Action
            clubId={clubId}
            id={row.id}
            name="status"
            value="approved"
            label={m.approve}
            action={setClubExerciseStatus}
          />
        )}
        {editor && row.status === "approved" && (
          <Action
            clubId={clubId}
            id={row.id}
            name="recommended"
            value={row.recommended ? "0" : "1"}
            label={row.recommended ? m.unrecommend : m.recommend}
            action={setClubExerciseRecommended}
          />
        )}
        {editor && row.status !== "archived" && (
          <Action
            clubId={clubId}
            id={row.id}
            name="status"
            value="archived"
            label={m.archive}
            action={setClubExerciseStatus}
          />
        )}
        {editor && row.status === "archived" && (
          <Action
            clubId={clubId}
            id={row.id}
            name="status"
            value="proposed"
            label={m.backToProposal}
            action={setClubExerciseStatus}
          />
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {mediaUrl && (
          <BankMedia
            kind={base?.media_kind ?? null}
            url={mediaUrl}
            alt={row.title}
            className="max-h-80 rounded-xl bg-white"
          />
        )}
        {zones.length > 0 && <ZoneMap zones={zones} className="w-28" />}
      </div>
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <BankFields content={row.content} />
      </section>
    </div>
  );
}
