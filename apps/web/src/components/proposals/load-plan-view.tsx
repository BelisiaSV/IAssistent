import { messages } from "@/lib/messages";
import { masDistance } from "@/lib/proposals/mas";
import { withShirtNames } from "@/lib/proposals/names";
import type { LoadPlanOutput } from "@/lib/proposals/types";
import { longDate, weekdayName } from "@/lib/weeks/dates";

const o = messages.proposals.output;
const l = messages.loadPlan;

const LOAD_STYLES: Record<string, string> = {
  rust: "bg-slate-100 text-slate-600",
  laag: "bg-green-100 text-green-800",
  matig: "bg-yellow-100 text-yellow-800",
  hoog: "bg-orange-100 text-orange-800",
  "zeer hoog": "bg-red-100 text-red-800",
};

export interface MasPlayer {
  shirtNumber: number;
  name: string;
  mas: number;
}

/** Read-only rendering of the Physical Coach load plan. */
export function LoadPlanView({
  output,
  names,
  masPlayers,
}: {
  output: LoadPlanOutput;
  names: Map<number, string>;
  masPlayers: MasPlayer[];
}) {
  const n = (text: string) => withShirtNames(text, names);
  const t = output.weektotaal;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 rounded-xl bg-brand/5 p-4 ring-1 ring-brand/20 sm:grid-cols-4">
        <Stat label={l.weektype} value={output.weektype} />
        <Stat label={l.total} value={`${l.au(t.au_doel)} · ${l.km(t.km_doel)}`} />
        <Stat
          label={l.reference}
          value={t.referentie_max_au ? `${l.au(t.referentie_max_au)}${t.belasting_pct ? ` (${l.pct(t.belasting_pct)})` : ""}` : "–"}
        />
        <Stat label={l.test} value={output.test.gepland && output.test.datum ? longDate(output.test.datum) : "–"} />
        <p className="text-sm sm:col-span-4">{n(output.weekfocus)}</p>
        <p className="text-xs text-slate-600 sm:col-span-4">
          {l.comparison}: {n(t.vergelijking)}
        </p>
        <p className="text-xs text-slate-600 sm:col-span-4">{n(output.test.toelichting)}</p>
        {output.cyclus_advies && (
          <p className="text-xs text-slate-600 sm:col-span-4">
            {l.cycleAdvice}: {n(output.cyclus_advies)}
          </p>
        )}
      </section>

      {output.dagen.map((day) => (
        <section
          key={day.datum}
          className={`break-inside-avoid rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${day.soort === "rust" ? "opacity-80" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold capitalize">{weekdayName(day.datum)}</span>
            <span className="text-sm text-slate-500">{longDate(day.datum)}</span>
            {day.md && <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">{day.md}</span>}
            <span className="text-sm text-slate-600">
              {[
                o.kind[day.soort],
                day.tijdstip,
                day.totale_duur_min ? o.duration(day.totale_duur_min) : null,
                day.rpe_doel ? l.rpeTarget(day.rpe_doel) : null,
                day.au_doel ? l.au(day.au_doel) : null,
                day.km_doel ? l.km(day.km_doel) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${LOAD_STYLES[day.belasting] ?? ""}`}>
              {o.load}: {day.belasting}
            </span>
          </div>
          <p className="mt-1 font-medium">{n(day.titel)}</p>
          {day.accenten.length > 0 && (
            <p className="text-xs text-slate-600">
              {l.accents}: {day.accenten.join(", ")}
            </p>
          )}
          {day.richtlijnen_training && (
            <p className="mt-1 text-sm">
              <span className="font-medium">{l.guidelines}:</span> {n(day.richtlijnen_training)}
            </p>
          )}

          {day.fysieke_blokken.length > 0 && (
            <div className="mt-3 space-y-3">
              {day.fysieke_blokken.map((block, i) => (
                <div key={i} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{n(block.naam)}</span>
                    <span className="text-xs text-slate-600 tabular-nums">
                      {[
                        o.duration(block.duur_min),
                        block.reeksen ? o.sets(block.reeksen) : null,
                        block.werk_per_reeks,
                        block.rust_tussen_reeksen ? `${o.rest} ${block.rust_tussen_reeksen}` : null,
                        block.intensiteit,
                        block.rpe ? o.rpe(block.rpe) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{n(block.doel)}</p>
                  {block.mas_pct && block.werk_sec && (
                    <MasTable pct={block.mas_pct} seconds={block.werk_sec} players={masPlayers} />
                  )}
                </div>
              ))}
            </div>
          )}
          {day.opmerking && <p className="mt-2 text-sm text-slate-600 italic">{n(day.opmerking)}</p>}
        </section>
      ))}

      {output.individueel.length > 0 && (
        <List title={o.individual} items={output.individueel.map((i) => n(`#${i.rugnummer}: ${i.advies}`))} />
      )}
      {output.aandachtspunten.length > 0 && <List title={o.attention} items={output.aandachtspunten.map(n)} />}
      {output.vragen_aan_coach.length > 0 && <List title={o.questions} items={output.vragen_aan_coach.map(n)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-semibold tracking-wide text-brand uppercase">{label}</span>
      <span className="block font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function MasTable({ pct, seconds, players }: { pct: number; seconds: number; players: MasPlayer[] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-brand">{l.masDistances(pct, seconds)}</summary>
      {players.length === 0 ? (
        <p className="mt-1 text-slate-500">{l.noMas}</p>
      ) : (
        <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-3">
          {players.map((p) => (
            <li key={p.shirtNumber} className="flex justify-between tabular-nums">
              <span>
                #{p.shirtNumber} {p.name} <span className="text-slate-400">({p.mas} km/u)</span>
              </span>
              <span className="font-medium">{l.meters(masDistance(p.mas, pct, seconds))}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="break-inside-avoid rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
