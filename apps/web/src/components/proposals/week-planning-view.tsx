import { messages } from "@/lib/messages";
import { withShirtNames } from "@/lib/proposals/names";
import type { WeekPlanningDay, WeekPlanningOutput } from "@/lib/proposals/types";
import { longDate, weekdayName } from "@/lib/weeks/dates";

const o = messages.proposals.output;

const LOAD_STYLES: Record<WeekPlanningDay["belasting"], string> = {
  rust: "bg-slate-100 text-slate-600",
  laag: "bg-green-100 text-green-800",
  matig: "bg-yellow-100 text-yellow-800",
  hoog: "bg-orange-100 text-orange-800",
  "zeer hoog": "bg-red-100 text-red-800",
};

/** Read-only rendering of the Assistant Coach week planning (also used for printing). */
export function WeekPlanningView({
  output,
  names,
}: {
  output: WeekPlanningOutput;
  names: Map<number, string>;
}) {
  const n = (text: string) => withShirtNames(text, names);

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-brand/5 p-4 ring-1 ring-brand/20 print:ring-0">
        <h3 className="text-xs font-semibold tracking-wide text-brand uppercase">{o.weekfocus}</h3>
        <p className="mt-1">{n(output.weekfocus)}</p>
      </section>

      {output.dagen.map((day) => (
        <section
          key={day.datum}
          className={`break-inside-avoid rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none ${
            day.soort === "rust" ? "opacity-80" : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold capitalize">{weekdayName(day.datum)}</span>
            <span className="text-sm text-slate-500">{longDate(day.datum)}</span>
            {day.md && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">{day.md}</span>
            )}
            <span className="text-sm text-slate-600">
              {[o.kind[day.soort], day.tijdstip, day.totale_duur_min ? o.duration(day.totale_duur_min) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${LOAD_STYLES[day.belasting]}`}>
              {o.load}: {day.belasting}
            </span>
          </div>
          <p className="mt-1 font-medium">{n(day.titel)}</p>
          {day.soort !== "rust" && <p className="text-sm text-slate-600">{n(day.doel)}</p>}

          {day.onderdelen.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">{o.parts}</th>
                    <th className="py-1 pr-3 font-medium">{o.organisation}</th>
                    <th className="py-1 pr-3 font-medium">{o.load}</th>
                    <th className="py-1 font-medium">{o.intensity}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {day.onderdelen.map((part, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3">
                        <span className="block text-xs text-slate-500">{o.phase[part.fase]}</span>
                        <span className="block font-medium">{n(part.naam)}</span>
                        <span className="block text-xs text-slate-600">{n(part.doel)}</span>
                        {part.coachingspunten.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
                            {part.coachingspunten.map((c, j) => (
                              <li key={j}>{n(c)}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        <span className="block">{n(part.organisatie)}</span>
                        <span className="block">
                          {o.players}: {n(part.spelers)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs whitespace-nowrap">
                        <span className="block font-medium">{o.duration(part.duur_min)}</span>
                        {part.reeksen && <span className="block">{o.sets(part.reeksen)}</span>}
                        {part.werk_per_reeks && <span className="block">{part.werk_per_reeks}</span>}
                        {part.rust_tussen_reeksen && (
                          <span className="block text-slate-500">
                            {o.rest}: {part.rust_tussen_reeksen}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-xs whitespace-nowrap">
                        <span className="block font-medium">{part.intensiteit}</span>
                        {part.rpe && <span className="block text-slate-500">{o.rpe(part.rpe)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {day.opmerking && <p className="mt-2 text-sm text-slate-600 italic">{n(day.opmerking)}</p>}
        </section>
      ))}

      {output.individueel.length > 0 && (
        <ListSection title={o.individual} items={output.individueel.map((i) => n(`#${i.rugnummer}: ${i.advies}`))} />
      )}
      {output.aandachtspunten.length > 0 && <ListSection title={o.attention} items={output.aandachtspunten.map(n)} />}
      {output.vragen_aan_coach.length > 0 && (
        <ListSection title={o.questions} items={output.vragen_aan_coach.map(n)} className="print:hidden" />
      )}
    </div>
  );
}

function ListSection({ title, items, className = "" }: { title: string; items: string[]; className?: string }) {
  return (
    <section className={`break-inside-avoid rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none ${className}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
