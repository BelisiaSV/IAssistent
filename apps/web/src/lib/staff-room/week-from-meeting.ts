import type { MeetingOverview, MeetingWeekPlan } from "@iassistent/staff-engine/content";

/**
 * The week plan of a staff meeting as the output of the Assistant Coach (the
 * week document of the microcycle). Same days and parts; fields the week
 * document has and the meeting does not are left empty.
 */
export function weekDocumentFromMeeting(overview: MeetingOverview & { weekplan: MeetingWeekPlan }) {
  const plan = overview.weekplan;
  return {
    weekfocus: overview.samenvatting,
    dagen: plan.dagen.map((day) => ({
      datum: day.datum,
      md: day.md,
      soort: day.soort,
      titel: day.titel,
      doel: day.doel,
      tijdstip: day.tijdstip,
      totale_duur_min: day.totale_duur_min,
      belasting: day.belasting,
      onderdelen: day.onderdelen.map((part) => ({
        oefening_id: part.oefening_id,
        fase: part.fase,
        naam: part.naam,
        doel: "",
        organisatie: part.organisatie,
        spelers: part.spelers,
        coachingspunten: part.coachingspunten,
        duur_min: part.duur_min,
        reeksen: part.reeksen,
        werk_per_reeks: part.werk_per_reeks,
        rust_tussen_reeksen: part.rust_tussen_reeksen,
        intensiteit: part.intensiteit,
        rpe: part.rpe,
        standaardsituaties: [],
      })),
      opmerking: day.opmerking,
    })),
    individueel: plan.beschikbaarheid.niet_beschikbaar.flatMap((p) =>
      p.rugnummer === null ? [] : [{ rugnummer: p.rugnummer, advies: [p.reden, p.aanpassing].filter(Boolean).join(" — ") }],
    ),
    aandachtspunten: overview.aandachtspunten,
    vragen_aan_coach: [] as string[],
  };
}

/** Trainings and matches for a new week input from the week plan (when the week has none yet). */
export function weekInputFromPlan(plan: MeetingWeekPlan, opponentOn: (date: string) => { name: string; home: boolean } | null, matchLabel: string) {
  const durationOk = (n: number | null) => n !== null && n >= 30 && n <= 240;
  return {
    trainings: plan.dagen
      .filter((d) => d.soort === "training" && d.tijdstip && durationOk(d.totale_duur_min))
      .map((d) => ({ date: d.datum, start: d.tijdstip!, duration_min: d.totale_duur_min! })),
    matches: plan.dagen
      .filter((d) => d.soort === "wedstrijd")
      .slice(0, 3)
      .map((d) => {
        const opponent = opponentOn(d.datum);
        return { date: d.datum, start: d.tijdstip, opponent: opponent?.name ?? matchLabel, home: opponent?.home ?? true };
      }),
  };
}
