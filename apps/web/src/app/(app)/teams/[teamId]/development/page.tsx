import { Modal } from "@/components/admin/modal";
import { Badge, Row, Rows } from "@/components/admin/rows";
import { ConfirmButton } from "@/components/clubs/forms";
import { EvaluationForm, GoalForm } from "@/components/development/forms";
import { GoalMeta } from "@/components/development/goal-row";
import { QualityBadge } from "@/components/quality/quality-review";
import { deleteGoal, setPlayerGoals } from "@/lib/development/actions";
import { loadDevelopment, qualityPoints, recurring } from "@/lib/development/load";
import { messages } from "@/lib/messages";
import { qualityLabels } from "@/lib/quality/labels";
import { staff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, longDate, shortDate, todayInBelgium, weekdayName } from "@/lib/weeks/dates";

const m = messages.development;

/** Evaluations and development of one team: training evaluations, recurring attention points, team and player goals. */
export default async function DevelopmentPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const today = todayInBelgium();
  const [data, recent, { data: players }] = await Promise.all([
    loadDevelopment(supabase, [team.id], addDays(today, -42), today),
    loadDevelopment(supabase, [team.id], addDays(today, -56), today),
    supabase.from("players").select("id, first_name, last_name, shirt_number").eq("team_id", team.id).is("archived_at", null).order("shirt_number"),
  ]);
  const catalog = staff.evaluation;
  const scale = Array.from({ length: catalog.beoordeling.max - catalog.beoordeling.min + 1 }, (_, i) => {
    const value = catalog.beoordeling.min + i;
    return { value, label: catalog.beoordeling.labels[String(value)] ?? String(value) };
  });
  const pointName = new Map(catalog.aandachtspunten.map((p) => [p.code, p.naam]));
  const points = recent ? recurring(recent.evaluations) : [];
  const fromQuality = recent ? qualityPoints(recent.reviews.map((r) => r.output)) : [];
  const labels = qualityLabels();
  const playerLabel = new Map((players ?? []).map((p) => [p.id, `${p.shirt_number ? `#${p.shirt_number} ` : ""}${p.first_name} ${p.last_name}`]));
  const playerOptions = (players ?? []).map((p) => ({ id: p.id, label: playerLabel.get(p.id)! }));

  return (
    <div className="space-y-5">
      <p className="max-w-4xl text-sm text-slate-600">{m.intro}</p>

      <Rows title={<span title={m.recurringIntro}>{m.recurring}</span>}>
        <li className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-sm">
          {points.length === 0 && fromQuality.length === 0 && <span className="text-xs text-slate-500">{m.recurringNone}</span>}
          {points.map((p) => (
            <Badge key={p.code} tone="amber">
              {p.naam} · {m.times(p.aantal)}
            </Badge>
          ))}
          {fromQuality.length > 0 && <span className="ml-2 text-xs text-slate-500">{m.fromQuality}:</span>}
          {fromQuality.map((p) => (
            <Badge key={p.code} tone="sky">
              {p.naam} · {m.times(p.aantal)}
            </Badge>
          ))}
        </li>
      </Rows>

      <Rows title={<span title={m.evaluationsIntro}>{m.evaluations}</span>} empty={m.noTrainings}>
        {(data?.trainings ?? []).map((t) => {
          const evaluation = data!.evaluations.find((e) => e.session_date === t.date) ?? null;
          const review = data!.reviews.find((r) => r.weekStart <= t.date && addDays(r.weekStart, 6) >= t.date);
          return (
            <Row
              key={t.date}
              meta={
                <>
                  {t.done && <Badge tone="green">{m.done}</Badge>}
                  {evaluation?.rating ? (
                    <span className="font-semibold tabular-nums" title={scale.find((s) => s.value === evaluation.rating)?.label}>
                      {"★".repeat(evaluation.rating)}
                      <span className="text-slate-300">{"★".repeat(catalog.beoordeling.max - evaluation.rating)}</span>
                    </span>
                  ) : (
                    !evaluation && <span>{m.notEvaluated}</span>
                  )}
                  {(evaluation?.attention_points ?? []).map((code) => (
                    <Badge key={code} tone="amber">
                      {pointName.get(code) ?? code}
                    </Badge>
                  ))}
                  {review && <QualityBadge review={review} labels={labels} />}
                </>
              }
              actions={
                canEdit && (
                  <Modal label={evaluation ? m.editEvaluation : m.evaluate} title={`${m.evaluations} — ${longDate(t.date)}`} primary={!evaluation} wide>
                    <EvaluationForm teamId={team.id} date={t.date} initial={evaluation} scale={scale} points={catalog.aandachtspunten} />
                  </Modal>
                )
              }
            >
              <span className="capitalize">{weekdayName(t.date)}</span> {shortDate(t.date)}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {t.start} · {t.duration_min} min
              </span>
              {(evaluation?.went_well || evaluation?.to_improve) && (
                <span className="block text-xs font-normal text-slate-600">
                  {[evaluation.went_well && `+ ${evaluation.went_well}`, evaluation.to_improve && `− ${evaluation.to_improve}`].filter(Boolean).join("  ")}
                </span>
              )}
            </Row>
          );
        })}
      </Rows>

      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{m.teamGoals}</h2>
          {canEdit && (
            <Modal label={m.newGoal} plus wide>
              <GoalForm teamId={team.id} goal={null} />
            </Modal>
          )}
        </div>
        <Rows empty={m.noTeamGoals}>
          {(data?.goals ?? []).map((g) => (
            <Row
              key={g.id}
              muted={g.status === "dropped"}
              meta={<GoalMeta status={g.status} progress={g.progress} targetDate={g.target_date} />}
              actions={
                canEdit && (
                  <>
                    <Modal label={m.update} title={g.title} wide>
                      <GoalForm teamId={team.id} goal={g} />
                    </Modal>
                    <form action={deleteGoal}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="goalId" value={g.id} />
                      <ConfirmButton label={m.delete} confirmText={m.deleteConfirm} />
                    </form>
                  </>
                )
              }
            >
              {g.title}
              {g.description && <span className="block text-xs font-normal text-slate-600">{g.description}</span>}
            </Row>
          ))}
        </Rows>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{m.playerGoals}</h2>
          {canEdit && (
            <form action={setPlayerGoals}>
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="enabled" value={team.player_goals_enabled ? "0" : "1"} />
              <button type="submit" className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
                {team.player_goals_enabled ? m.playerGoalsDisable : m.playerGoalsOn}
              </button>
            </form>
          )}
          {canEdit && team.player_goals_enabled && (
            <Modal label={m.newGoal} plus wide>
              <GoalForm teamId={team.id} goal={null} players={playerOptions} />
            </Modal>
          )}
        </div>
        {team.player_goals_enabled ? (
          <Rows empty={m.noPlayerGoals}>
            {(data?.playerGoals ?? []).map((g) => (
              <Row
                key={g.id}
                muted={g.status === "dropped"}
                meta={<GoalMeta status={g.status} progress={g.progress} targetDate={g.target_date} />}
                actions={
                  canEdit && (
                    <>
                      <Modal label={m.update} title={g.title} wide>
                        <GoalForm teamId={team.id} goal={{ ...g, description: g.note }} players={playerOptions} />
                      </Modal>
                      <form action={deleteGoal}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <input type="hidden" name="goalId" value={g.id} />
                        <input type="hidden" name="kind" value="player" />
                        <ConfirmButton label={m.delete} confirmText={m.deleteConfirm} />
                      </form>
                    </>
                  )
                }
              >
                <span className="text-slate-500">{playerLabel.get(g.player_id) ?? "—"}</span> · {g.title}
                {g.note && <span className="block text-xs font-normal text-slate-600">{g.note}</span>}
              </Row>
            ))}
          </Rows>
        ) : (
          <p className="text-xs text-slate-500">{m.playerGoalsOff}</p>
        )}
      </div>
    </div>
  );
}
