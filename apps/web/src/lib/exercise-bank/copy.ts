import type { TablesInsert } from "@iassistent/db";

import { messages } from "@/lib/messages";

import { bankExercise, type BankRow } from "./staff";

const t = messages.exerciseBank.coach;
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const lines = (items: string[], maxItems: number, maxLength = 300) => items.slice(0, maxItems).map((i) => clip(i, maxLength));

/**
 * A bank exercise as an exercise of the coach's own library. The coach sets
 * the phase, players and standard load himself; the bank has none.
 */
export function bankToExercise(row: BankRow): TablesInsert<"exercises"> {
  const ex = bankExercise(row);
  const organisation = [
    ...ex.organisatie,
    ...(ex.veldafmeting ? [ex.veldafmeting] : []),
    ...(ex.materiaal.length ? [`${t.material}: ${ex.materiaal.join(", ")}`] : []),
  ].join("\n");
  return {
    title: clip(ex.titel, 120),
    kind: "exercise",
    labels: [...new Set(ex.tags.map((tag) => clip(tag.toLowerCase(), 40)))].slice(0, 20),
    organisation: organisation ? clip(organisation, 2000) : null,
    course: lines([...ex.verloop, ...(ex.regels ? [ex.regels] : [])], 30),
    coaching_points: lines(ex.coachingspunten, 30),
    variations: lines(
      [...(ex.makkelijker ? [`${t.easier}: ${ex.makkelijker}`] : []), ...(ex.moeilijker ? [`${t.harder}: ${ex.moeilijker}`] : [])],
      30,
    ),
    bank_number: row.number,
  };
}
