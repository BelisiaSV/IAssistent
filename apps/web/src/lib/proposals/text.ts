import { messages } from "@/lib/messages";
import { longDate, weekdayName } from "@/lib/weeks/dates";

import { withShirtNames } from "./names";
import type { MatchPlanOutput, WeekPlanningOutput } from "./types";

const o = messages.proposals.output;

/** Plain-text week planning, ready to paste in a message to players and staff. */
export function weekPlanningToText(
  output: WeekPlanningOutput,
  options: { title: string; names: Map<number, string> },
): string {
  const n = (text: string) => withShirtNames(text, options.names);
  const lines: string[] = [`*${options.title}*`, "", `${o.weekfocus}: ${n(output.weekfocus)}`, ""];

  for (const day of output.dagen) {
    const head = [
      `${weekdayName(day.datum)} ${longDate(day.datum)}`,
      day.md,
      day.tijdstip,
      day.totale_duur_min ? o.duration(day.totale_duur_min) : null,
    ].filter(Boolean);
    lines.push(`*${head.join(" · ")}*`);
    lines.push(`${o.kind[day.soort]}: ${n(day.titel)}`);
    if (day.soort === "training") {
      lines.push(`${o.load}: ${day.belasting}`);
      for (const part of day.onderdelen) {
        const load = [
          o.duration(part.duur_min),
          part.reeksen ? o.sets(part.reeksen) : null,
          part.werk_per_reeks,
          part.rust_tussen_reeksen ? `${o.rest} ${part.rust_tussen_reeksen}` : null,
          part.intensiteit,
          part.rpe ? o.rpe(part.rpe) : null,
        ].filter(Boolean);
        lines.push(`- ${o.phase[part.fase]}: ${n(part.naam)} (${load.join(", ")})`);
      }
    }
    if (day.opmerking) lines.push(n(day.opmerking));
    lines.push("");
  }

  if (output.individueel.length) {
    lines.push(`*${o.individual}*`);
    for (const item of output.individueel) lines.push(`- ${n(`#${item.rugnummer}`)}: ${n(item.advies)}`);
  }
  return lines.join("\n").trim() + "\n";
}

/** Plain-text match talk (key message, lineup, key points), ready to paste in a message. */
export function matchTalkToText(
  output: MatchPlanOutput,
  options: { title: string; names: Map<number, string> },
): string {
  const n = (text: string) => withShirtNames(text, options.names);
  const t = messages.matchPlan;
  const lines = [
    `*${options.title}*`,
    "",
    `${t.keyMessage}: ${n(output.speelplan.kernboodschap)}`,
    "",
    `*${t.lineup} (${output.opstelling.formatie})*`,
    ...output.opstelling.basis.map((b) => `${b.post}: ${n(`#${b.rugnummer}`)}`),
  ];
  if (output.opstelling.bank.length) {
    lines.push(`${t.bench}: ${output.opstelling.bank.map((nr) => n(`#${nr}`)).join(", ")}`);
  }
  lines.push("", `*${output.wedstrijdbespreking.titel}*`);
  output.wedstrijdbespreking.kernpunten.forEach((k, i) => lines.push(`${i + 1}. ${n(k)}`));
  lines.push("", n(output.wedstrijdbespreking.afsluiter));
  return lines.join("\n");
}
