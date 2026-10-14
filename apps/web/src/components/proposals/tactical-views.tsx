import type { FormationCatalog } from "@iassistent/staff-engine/content";
import type { ReactNode } from "react";

import { Pitch } from "@/components/pitch";
import { messages } from "@/lib/messages";
import { withShirtNames } from "@/lib/proposals/names";
import type { MatchPrepOutput, SetPiece, TacticalWeekOutput } from "@/lib/proposals/types";

import { DrawingView } from "./drawing";

const t = messages.matchPlan;
const o = messages.proposals.output;

/**
 * The tactical part of the week document: opponent, lessons and game plan.
 * Shirt numbers of our squad get their names (`names`); those of the opponent
 * get the names from their lineup (`opponentNames`).
 */
export function TacticalWeekView({
  output,
  names,
  opponentNames,
}: {
  output: TacticalWeekOutput;
  names: Map<number, string>;
  opponentNames: Map<number, string>;
}) {
  const n = (text: string) => withShirtNames(text, names);
  const them = (text: string) => withShirtNames(text, opponentNames);
  const opp = output.tegenstander;
  const plan = output.speelplan;

  return (
    <div className="space-y-5">
      <Card title={`${t.opponent}: ${opp.naam}${opp.formatie ? ` (${opp.formatie})` : ""}`}>
        <p className="text-sm">{them(opp.samenvatting)}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <List title={t.strengths} items={opp.sterktes.map(them)} />
          <List title={t.weaknesses} items={opp.zwaktes.map(them)} />
        </div>
        {opp.sleutelspelers.length > 0 && (
          <List
            title={t.keyPlayers}
            items={opp.sleutelspelers.map((s) => {
              const name = opponentNames.get(s.rugnummer);
              return `#${s.rugnummer}${name ? ` ${name}` : ""}${s.post ? ` (${s.post})` : ""}: ${s.aandacht}`;
            })}
            className="mt-3"
          />
        )}
      </Card>

      {output.lessen.length > 0 && (
        <Card title={t.lessons}>
          <List items={output.lessen.map(n)} />
        </Card>
      )}

      <Card title={`${t.gamePlan} · ${plan.formatie}`}>
        <p className="rounded-md bg-brand/5 px-3 py-2 font-medium ring-1 ring-brand/20">
          {t.keyMessage}: {n(plan.kernboodschap)}
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <List title={t.inPossession} items={plan.balbezit.map(n)} />
          <List title={t.outOfPossession} items={plan.balverlies.map(n)} />
          <List title={t.transitionAttack} items={plan.omschakeling_aanval.map(n)} />
          <List title={t.transitionDefence} items={plan.omschakeling_verdediging.map(n)} />
        </div>
        <p className="mt-3 text-sm">
          <span className="font-medium">{t.pressing}:</span> {n(plan.pressing)}
        </p>
      </Card>
    </div>
  );
}

/** Set pieces in a grid (week document and match preparation). */
export function SetPieces({ setPieces, names }: { setPieces: SetPiece[]; names: Map<number, string> }) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{t.setPieces}</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        {setPieces.map((sp, i) => (
          <SetPieceCard key={i} setPiece={sp} names={names} />
        ))}
      </div>
    </section>
  );
}

/** The match preparation: lineup, set pieces with final tasks, scenarios and the match talk. */
export function MatchPrepView({
  output,
  names,
  formations,
  actions,
}: {
  output: MatchPrepOutput;
  names: Map<number, string>;
  formations: FormationCatalog;
  actions?: ReactNode;
}) {
  const n = (text: string) => withShirtNames(text, names);
  return (
    <div className="space-y-5">
      <Card title={`${t.lineup} · ${output.opstelling.formatie}`} actions={actions}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <LineupPitch lineup={output.opstelling} names={names} formations={formations} />
          <div className="space-y-3 text-sm">
            <ul className="space-y-1">
              {output.opstelling.basis.map((b) => (
                <li key={b.post}>
                  <span className="inline-block w-12 font-mono text-xs text-slate-500">{b.post}</span>
                  <span className="font-medium">{n(`#${b.rugnummer}`)}</span>
                  <span className="text-slate-600"> — {n(b.taak)}</span>
                </li>
              ))}
            </ul>
            {output.opstelling.bank.length > 0 && (
              <p>
                <span className="font-medium">{t.bench}:</span>{" "}
                {output.opstelling.bank.map((nr) => n(`#${nr}`)).join(", ")}
              </p>
            )}
            <p className="text-slate-600">{n(output.opstelling.toelichting)}</p>
          </div>
        </div>
      </Card>

      <SetPieces setPieces={output.standaardsituaties} names={names} />

      {output.scenarios.length > 0 && (
        <Card title={t.scenarios}>
          <ul className="space-y-2 text-sm">
            {output.scenarios.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{n(s.situatie)}</span> → {n(s.aanpassing)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`${t.talk}: ${output.wedstrijdbespreking.titel}`}>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {output.wedstrijdbespreking.kernpunten.map((k, i) => (
            <li key={i}>{n(k)}</li>
          ))}
        </ol>
        <p className="mt-2 font-semibold">{n(output.wedstrijdbespreking.afsluiter)}</p>
      </Card>

      {output.aandachtspunten.length > 0 && (
        <Card title={o.attention}>
          <List items={output.aandachtspunten.map(n)} />
        </Card>
      )}
      {output.vragen_aan_coach.length > 0 && (
        <Card title={o.questions}>
          <List items={output.vragen_aan_coach.map(n)} />
        </Card>
      )}
    </div>
  );
}

/** Lineup on a pitch: shirt number and name per slot. */
export function LineupPitch({
  lineup,
  names,
  formations,
}: {
  lineup: MatchPrepOutput["opstelling"];
  names: Map<number, string>;
  formations: FormationCatalog;
}) {
  const formation = formations.formaties.find((f) => f.code === lineup.formatie);
  return (
    <Pitch>
      {lineup.basis.map((b) => {
        const slot = formation?.posten.find((s) => s.id === b.post);
        if (!slot) return null;
        return (
          <div
            key={b.post}
            className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white shadow">
              {b.rugnummer}
            </span>
            <span className="mt-0.5 max-w-full truncate rounded bg-black/50 px-1 text-[10px] text-white">
              {names.get(b.rugnummer) ?? b.post}
            </span>
          </div>
        );
      })}
    </Pitch>
  );
}

/** One set piece: drawing, agreements and tasks per shirt number. Also used on the dressing-room print. */
export function SetPieceCard({
  setPiece,
  names,
  large = false,
}: {
  setPiece: SetPiece;
  names: Map<number, string>;
  large?: boolean;
}) {
  const n = (text: string) => withShirtNames(text, names);
  return (
    <article className={`break-inside-avoid rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0 ${large ? "space-y-4" : "space-y-3"}`}>
      <header>
        <p className="text-xs font-semibold tracking-wide text-brand uppercase">{t.setPieceKind[setPiece.soort]}</p>
        <h4 className={large ? "text-3xl font-bold" : "font-semibold"}>{setPiece.titel}</h4>
      </header>
      <DrawingView drawing={setPiece.tekening} />
      {setPiece.tekening.uitleg.length > 0 && (
        <ol className={`list-decimal space-y-0.5 pl-5 ${large ? "text-lg" : "text-sm"}`}>
          {setPiece.tekening.uitleg.map((step, i) => (
            <li key={i}>{n(step)}</li>
          ))}
        </ol>
      )}
      <div className={`grid gap-4 ${large ? "grid-cols-2 text-lg" : "text-sm sm:grid-cols-2"}`}>
        <div>
          <p className="font-medium">{t.agreements}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {setPiece.afspraken.map((a, i) => (
              <li key={i}>{n(a)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium">{t.tasks}</p>
          <ul className="space-y-0.5">
            {setPiece.taken.map((task, i) => (
              <li key={i}>
                <span className="font-semibold">{n(`#${task.rugnummer}`)}</span>: {n(task.taak)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function Card({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function List({ title, items, className = "" }: { title?: string; items: string[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={className}>
      {title && <p className="text-sm font-medium">{title}</p>}
      <ul className="list-disc space-y-0.5 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
