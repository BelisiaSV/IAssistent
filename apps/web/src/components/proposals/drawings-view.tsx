import { messages } from "@/lib/messages";
import { withShirtNames } from "@/lib/proposals/names";
import type { DrawingsOutput } from "@/lib/proposals/types";
import { longDate, weekdayName } from "@/lib/weeks/dates";

import { DrawingView } from "./drawing";

const d = messages.drawings;
const o = messages.proposals.output;

/** The exercises of the week planning, drawn by the Tactical Coach, per day. */
export function DrawingsView({ output, names }: { output: DrawingsOutput; names: Map<number, string> }) {
  const n = (text: string) => withShirtNames(text, names);
  const days = [...new Set(output.oefeningen.map((x) => x.datum))].sort();

  return (
    <div className="space-y-6">
      {days.map((date) => (
        <section key={date} className="space-y-3">
          <h3 className="font-semibold capitalize">
            {weekdayName(date)} <span className="font-normal text-slate-500 normal-case">{longDate(date)}</span>
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {output.oefeningen
              .filter((x) => x.datum === date)
              .map((x, i) => (
                <ExerciseCard key={i} exercise={x} n={n} />
              ))}
          </div>
        </section>
      ))}
      {output.opmerkingen.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none">
          <h3 className="text-sm font-semibold">{o.attention}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {output.opmerkingen.map((x, i) => (
              <li key={i}>{n(x)}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ExerciseCard({
  exercise,
  n,
}: {
  exercise: DrawingsOutput["oefeningen"][number];
  n: (text: string) => string;
}) {
  return (
    <article className="break-inside-avoid space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:shadow-none">
      <header>
        <p className="text-xs text-slate-500">{o.phase[exercise.fase]}</p>
        <h4 className="font-semibold">{n(exercise.onderdeel)}</h4>
      </header>
      <DrawingView drawing={exercise.tekening} />
      <p className="text-sm">
        <span className="font-medium">{d.organisation}:</span> {n(exercise.organisatie)}
      </p>
      <Steps title={d.course} items={exercise.verloop.map(n)} ordered />
      <Steps title={d.coaching} items={exercise.coachingspunten.map(n)} />
      <Steps title={d.variations} items={exercise.variaties.map(n)} />
    </article>
  );
}

function Steps({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <div className="text-sm">
      <p className="font-medium">{title}</p>
      <List className={`${ordered ? "list-decimal" : "list-disc"} space-y-0.5 pl-5 text-slate-700`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </List>
    </div>
  );
}
