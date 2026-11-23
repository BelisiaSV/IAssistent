import type { SharedTraining } from "@/lib/clubs/knowledge";
import { messages } from "@/lib/messages";

const m = messages.club.knowledge;

/** The parts of a shared training (snapshot of the Assistant Coach's day). */
export function SharedTrainingView({ training }: { training: SharedTraining }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {[training.md, training.doel, training.totale_duur_min ? `${training.totale_duur_min} min` : null, training.belasting]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <h3 className="text-sm font-semibold text-slate-700">{m.parts}</h3>
      <ol className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
        {training.onderdelen.map((p, i) => (
          <li key={i} className="space-y-1 px-3 py-2 text-sm">
            <p className="font-medium">
              <span className="mr-2 text-xs tracking-wide text-slate-500 uppercase">{p.fase}</span>
              {p.naam}
              {p.bank_nummer && <span className="ml-2 font-mono text-xs text-slate-500">{p.bank_nummer}</span>}
            </p>
            <p className="text-xs text-slate-600">
              {[
                p.duur_min ? `${p.duur_min} min` : null,
                p.reeksen ? `${p.reeksen} × ${p.werk_per_reeks ?? ""}${p.rust_tussen_reeksen ? ` (rust ${p.rust_tussen_reeksen})` : ""}` : null,
                p.intensiteit,
                p.rpe ? `RPE ${p.rpe}` : null,
                p.spelers,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.doel && <p className="text-xs">{p.doel}</p>}
            {p.organisatie && <p className="text-xs text-slate-600">{p.organisatie}</p>}
            {p.coachingspunten.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-slate-600">
                {p.coachingspunten.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
