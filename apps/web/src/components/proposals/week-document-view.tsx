import Link from "next/link";

import type { WeekExercises } from "@/lib/exercises/week";
import { messages } from "@/lib/messages";
import { withShirtNames } from "@/lib/proposals/names";
import type {
  DrawingsOutput,
  LoadPlanOutput,
  TacticalWeekOutput,
  WeekPlanningDay,
  WeekPlanningOutput,
} from "@/lib/proposals/types";
import { longDate, weekdayName } from "@/lib/weeks/dates";

import { AnimatedDrawing } from "./animated-drawing";
import { DrawingView } from "./drawing";
import { LoadPlanView, MasTable, type MasPlayer } from "./load-plan-view";
import { Card, List, SetPieces, TacticalWeekView } from "./tactical-views";

const r = messages.staffRun;
const o = messages.proposals.output;
const l = messages.loadPlan;
const d = messages.drawings;
const x = messages.exercises;

const LOAD_STYLES: Record<WeekPlanningDay["belasting"], string> = {
  rust: "bg-slate-100 text-slate-600",
  laag: "bg-green-100 text-green-800",
  matig: "bg-yellow-100 text-yellow-800",
  hoog: "bg-orange-100 text-orange-800",
  "zeer hoog": "bg-red-100 text-red-800",
};

export interface WeekDocument {
  pc: LoadPlanOutput | null;
  tc: TacticalWeekOutput | null;
  ac: WeekPlanningOutput | null;
  tco: DrawingsOutput | null;
}

/**
 * The week document of the staff in one piece: week focus, tactics, and per
 * training day the exercises with drawing, explanation, load and tactical
 * accent. Also used for printing.
 */
export function WeekDocumentView({
  doc,
  names,
  opponentNames,
  masPlayers,
  exercises,
  runId,
}: {
  doc: WeekDocument;
  names: Map<number, string>;
  opponentNames: Map<number, string>;
  masPlayers: MasPlayer[];
  /** Library exercises the planning uses (only for the coach who owns them). */
  exercises?: WeekExercises;
  /** The run shown, when the coach may save new set pieces in the library. */
  runId?: string;
}) {
  const n = (text: string) => withShirtNames(text, names);
  const { pc, tc, ac, tco } = doc;
  const days = ac?.dagen ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-xl bg-brand/5 p-4 ring-1 ring-brand/20 print:ring-slate-300">
        {ac && (
          <p>
            <span className="text-xs font-semibold tracking-wide text-brand uppercase">{o.weekfocus}</span>
            <span className="block">{n(ac.weekfocus)}</span>
          </p>
        )}
        {tc && (
          <p className="font-medium">
            {messages.matchPlan.keyMessage}: {n(tc.speelplan.kernboodschap)}
          </p>
        )}
        {pc && (
          <p className="text-sm text-slate-700">
            {[`${l.weektype}: ${pc.weektype}`, `${l.total}: ${l.au(pc.weektotaal.au_doel)} · ${l.km(pc.weektotaal.km_doel)}`].join(" · ")}
          </p>
        )}
      </section>

      {tc && <TacticalWeekView output={tc} names={names} opponentNames={opponentNames} />}

      {!ac && <p className="text-sm text-slate-600">{r.missing(r.stepNames.ac!)}</p>}

      {days.map((day) => {
        const load = pc?.dagen.find((x) => x.datum === day.datum);
        const accent = tc?.trainingsaccenten.find((a) => a.datum === day.datum);
        return (
          <section
            key={day.datum}
            className={`space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:break-before-page print:shadow-none print:ring-0 ${
              day.soort === "rust" ? "opacity-80 print:break-before-auto" : ""
            }`}
          >
            <header className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold capitalize">{weekdayName(day.datum)}</span>
              <span className="text-sm text-slate-500">{longDate(day.datum)}</span>
              {day.md && <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">{day.md}</span>}
              <span className="text-sm text-slate-600">
                {[o.kind[day.soort], day.tijdstip, day.totale_duur_min ? o.duration(day.totale_duur_min) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${LOAD_STYLES[day.belasting]}`}>
                {o.load}: {day.belasting}
              </span>
            </header>
            <div>
              <p className="font-medium">{n(day.titel)}</p>
              {day.soort !== "rust" && <p className="text-sm text-slate-600">{n(day.doel)}</p>}
            </div>

            {day.soort === "training" && (load || accent) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {load && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium">{r.loadOfDay}</p>
                    <p className="text-slate-700">
                      {[
                        load.rpe_doel ? l.rpeTarget(load.rpe_doel) : null,
                        load.au_doel ? l.au(load.au_doel) : null,
                        load.km_doel ? l.km(load.km_doel) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {load.accenten.length > 0 && (
                      <p className="text-xs text-slate-600">
                        {l.accents}: {load.accenten.join(", ")}
                      </p>
                    )}
                    {load.richtlijnen_training && <p className="mt-1 text-xs text-slate-600">{n(load.richtlijnen_training)}</p>}
                  </div>
                )}
                {accent && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium">
                      {r.tacticsOfDay}: {n(accent.thema)}
                    </p>
                    <p className="text-slate-700">{n(accent.doel)}</p>
                    {accent.aandachtspunten.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                        {accent.aandachtspunten.map((a, i) => (
                          <li key={i}>{n(a)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {day.onderdelen.map((part, i) => {
              const exercise = part.oefening_id ? exercises?.items.get(part.oefening_id) : undefined;
              const drawing =
                part.oefening_id || part.standaardsituaties?.length
                ? undefined
                : tco?.oefeningen.find((t) => t.datum === day.datum && t.onderdeel === part.naam);
              const course = exercise?.course ?? drawing?.verloop ?? [];
              const variations = exercise?.variations ?? drawing?.variaties ?? [];
              const block = load?.fysieke_blokken.find((b) => b.naam === part.naam);
              return (
                <article
                  key={i}
                  className="grid break-inside-avoid gap-4 border-t border-slate-100 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:grid-cols-2"
                >
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {o.phase[part.fase]}
                        {part.oefening_id && (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">
                            {x.fromLibrary}
                            {exercise?.hasVideo ? ` · ${x.withVideo}` : ""}
                          </span>
                        )}
                        {exercise && (
                          <Link href={`/exercises/${exercise.id}`} className="underline hover:text-brand print:hidden">
                            {x.openExercise}
                          </Link>
                        )}
                      </p>
                      <h4 className="text-base font-semibold">{n(part.naam)}</h4>
                      <p className="text-slate-600">
                        {r.goal}: {n(part.doel)}
                      </p>
                    </div>
                    <p className="rounded-md bg-slate-50 px-2 py-1 text-xs tabular-nums">
                      <span className="font-medium">{o.load}:</span>{" "}
                      {[
                        o.duration(part.duur_min),
                        part.reeksen ? o.sets(part.reeksen) : null,
                        part.werk_per_reeks,
                        part.rust_tussen_reeksen ? `${o.rest} ${part.rust_tussen_reeksen}` : null,
                        part.intensiteit,
                        part.rpe ? o.rpe(part.rpe) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p>
                      <span className="font-medium">{d.organisation}:</span> {n(drawing?.organisatie ?? part.organisatie)}
                      <span className="block text-xs text-slate-600">
                        {o.players}: {n(part.spelers)}
                      </span>
                    </p>
                    {(part.standaardsituaties?.length ?? 0) > 0 && (
                      <div>
                        <p className="font-medium">{x.setPiecesTrained}</p>
                        <ul className="list-disc space-y-0.5 pl-5">
                          {part.standaardsituaties!.map((title) => {
                            const index = tc?.standaardsituaties.findIndex((sp) => sp.titel === title) ?? -1;
                            const sp = index >= 0 ? tc!.standaardsituaties[index] : undefined;
                            return (
                              <li key={title}>
                                {sp ? (
                                  <a href={`#standaardsituatie-${index}`} className="underline hover:text-brand">
                                    {title}
                                  </a>
                                ) : (
                                  title
                                )}
                                {sp?.standaardsituatie_id && <span className="ml-1 text-xs text-brand">({x.fromLibrary})</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <Steps title={d.course} items={course.map(n)} ordered />
                    <Steps title={d.coaching} items={part.coachingspunten.map(n)} />
                    <Steps title={d.variations} items={variations.map(n)} />
                    {block?.mas_pct && block.werk_sec && (
                      <MasTable pct={block.mas_pct} seconds={block.werk_sec} players={masPlayers} />
                    )}
                  </div>
                  {exercise?.animation ? (
                    <AnimatedDrawing
                      animation={exercise.animation}
                      theme={exercises!.display.theme}
                      logoUrl={exercises!.logoUrl}
                      logoOn={exercises!.display.logoOn}
                      labels={x.player}
                    />
                  ) : (
                    drawing && <DrawingView drawing={drawing.tekening} />
                  )}
                </article>
              );
            })}
            {day.opmerking && <p className="text-sm text-slate-600 italic">{n(day.opmerking)}</p>}
          </section>
        );
      })}

      {tc && tc.standaardsituaties.length > 0 && (
        <div className="print:break-before-page">
          <SetPieces
            setPieces={tc.standaardsituaties}
            names={names}
            library={exercises}
            source={runId ? { runId, step: "tc" } : undefined}
          />
        </div>
      )}

      <PerRole
        title={r.individualBy}
        items={{
          "physical-coach": (pc?.individueel ?? []).map((i) => n(`#${i.rugnummer}: ${i.advies}`)),
          "assistant-coach": (ac?.individueel ?? []).map((i) => n(`#${i.rugnummer}: ${i.advies}`)),
        }}
      />
      <PerRole
        title={r.attentionBy}
        items={{
          "physical-coach": (pc?.aandachtspunten ?? []).map(n),
          "tactical-coach": [...(tc?.aandachtspunten ?? []), ...(tco?.opmerkingen ?? [])].map(n),
          "assistant-coach": (ac?.aandachtspunten ?? []).map(n),
        }}
      />
      <div className="print:hidden">
        <PerRole
          title={r.questionsBy}
          items={{
            "physical-coach": (pc?.vragen_aan_coach ?? []).map(n),
            "tactical-coach": (tc?.vragen_aan_coach ?? []).map(n),
            "assistant-coach": (ac?.vragen_aan_coach ?? []).map(n),
          }}
        />
      </div>

      {pc && (
        <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:hidden">
          <summary className="cursor-pointer font-medium">{r.fullLoadPlan}</summary>
          <div className="mt-4">
            <LoadPlanView output={pc} names={names} masPlayers={masPlayers} />
          </div>
        </details>
      )}
    </div>
  );
}

function PerRole({ title, items }: { title: (role: string) => string; items: Record<string, string[]> }) {
  const filled = Object.entries(items).filter(([, list]) => list.length > 0);
  if (!filled.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {filled.map(([role, list]) => (
        <Card key={role} title={title(r.roleNames[role] ?? role)}>
          <List items={list} />
        </Card>
      ))}
    </div>
  );
}

function Steps({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ListTag className={`${ordered ? "list-decimal" : "list-disc"} space-y-0.5 pl-5 text-slate-700`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ListTag>
    </div>
  );
}
