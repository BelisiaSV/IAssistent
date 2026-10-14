import type { RoleContext } from "../context";
import { roleExample } from "../prompt";
import type { Staff } from "../types";
import { StaffGenerationError, type StaffModelProvider } from "./types";

type Day = Record<string, unknown> & { soort: string; md: string | null };
type Example = Record<string, unknown>;

/**
 * Test mode without AI: builds a proposal from the example output of the role
 * task in /staff (voorbeelden/). Content comes entirely from /staff; this only
 * fits it onto the week (dates, times, available players, planned exercises).
 */
export const exampleProvider: StaffModelProvider = {
  id: "example",
  async generate({ staff, role, task, context }) {
    const example = roleExample(role, task) as Example | null;
    if (!example) {
      throw new StaffGenerationError("provider_error", `role ${role.id} (${task}) has no example`);
    }
    let output: Example;
    if (Array.isArray(example.dagen)) output = fitWeek(example, context);
    else if (example.speelplan && example.opstelling) output = fitMatchPlan(example, context, staff);
    else if (Array.isArray(example.oefeningen)) output = fitDrawings(example, context);
    else output = example;
    return { output, provider: "example", model: null, usage: null };
  },
};

/** Week-shaped outputs (Assistant Coach, Physical Coach). */
function fitWeek(example: Example, context: RoleContext): Example {
  const days = example.dagen as Day[];
  const byKind = (kind: string) => days.filter((d) => d.soort === kind);
  const trainings = byKind("training");
  const matches = byKind("wedstrijd");
  const rests = byKind("rust");
  if (!trainings.length || !matches.length || !rests.length) {
    throw new StaffGenerationError("provider_error", "example needs a training, a match and a rest day");
  }

  let next = 0;
  const dagen = context.weekinput.dagen.map((day) => {
    if (day.wedstrijd) {
      return { ...matches[0]!, datum: day.datum, md: day.md, tijdstip: day.wedstrijd.aanvang };
    }
    if (day.training) {
      const template = trainings.find((t) => t.md === day.md) ?? trainings[next++ % trainings.length]!;
      return {
        ...template,
        datum: day.datum,
        md: day.md,
        tijdstip: day.training.aanvang,
        totale_duur_min: day.training.duur_min,
      };
    }
    const rest = rests.find((r) => r.md === day.md) ?? rests[0]!;
    return { ...rest, datum: day.datum, md: day.md };
  });

  // Keep the week type of this week when the role reports one (Physical Coach).
  const weektype = context.weekinput.periodisering.weektype?.code;
  const extra = "weektype" in example && weektype ? { weektype } : {};
  return { ...example, ...extra, dagen, individueel: fitIndividual(example, context) };
}

function fitIndividual(example: Example, context: RoleContext) {
  const advice = (example.individueel ?? []) as { advies: string }[];
  return context.kern
    .filter((p) => !p.beschikbaar && p.rugnummer !== null)
    .map((p, i) => ({ rugnummer: p.rugnummer!, advies: advice.length ? advice[i % advice.length]!.advies : "" }));
}

/** Tactical Coach match plan: lineup from the available squad, accents on training days. */
function fitMatchPlan(example: Example, context: RoleContext, staff: Staff): Example {
  const lineup = example.opstelling as { formatie: string; basis: { post: string; taak: string }[]; bank: number[]; toelichting: string };
  const formation = staff.formations.formaties.find((f) => f.code === lineup.formatie);
  const available = context.kern.filter((p) => p.beschikbaar && p.rugnummer !== null);
  const used = new Set<number>();
  const pick = (position: string, secondary: boolean) =>
    available.find(
      (p) => !used.has(p.rugnummer!) && (secondary ? p.posities.includes(position) : p.posities[0] === position),
    );

  const basis = (formation?.posten ?? []).flatMap((slot) => {
    const player = pick(slot.positie, false) ?? pick(slot.positie, true) ?? available.find((p) => !used.has(p.rugnummer!));
    if (!player) return [];
    used.add(player.rugnummer!);
    const taak = lineup.basis.find((b) => b.post === slot.id)?.taak ?? lineup.basis[0]?.taak ?? "";
    return [{ post: slot.id, rugnummer: player.rugnummer!, taak }];
  });
  const bank = available
    .filter((p) => !used.has(p.rugnummer!))
    .slice(0, lineup.bank.length)
    .map((p) => p.rugnummer!);

  const accents = example.trainingsaccenten as { md: string | null }[];
  const trainingDays = context.weekinput.dagen.filter((d) => d.training);
  const trainingsaccenten = trainingDays.map((day, i) => ({
    ...(accents.find((a) => a.md === day.md) ?? accents[i % accents.length]!),
    datum: day.datum,
    md: day.md,
  }));

  const opponent = example.tegenstander as Example;
  return {
    ...example,
    tegenstander: {
      ...opponent,
      naam: context.tegenstander?.naam ?? opponent.naam,
      formatie: context.tegenstander?.formatie ?? context.tegenstander?.opstelling?.formatie ?? opponent.formatie,
    },
    opstelling: { ...lineup, basis, bank },
    trainingsaccenten,
  };
}

/** Tactical Coach drawings: one drawing per part of the approved Assistant Coach planning. */
function fitDrawings(example: Example, context: RoleContext): Example {
  const planning = context.staf["assistant-coach"] as
    | { dagen?: { datum: string; onderdelen?: { naam: string; fase: string; organisatie: string; coachingspunten: string[] }[] }[] }
    | undefined;
  if (!planning?.dagen) {
    throw new StaffGenerationError("provider_error", "no approved week planning of the Assistant Coach");
  }
  const drawings = example.oefeningen as (Example & { onderdeel: string; fase: string; tekening: Example })[];
  const counters = new Map<string, number>();
  const oefeningen = planning.dagen.flatMap((day) =>
    (day.onderdelen ?? []).map((part) => {
      const sameName = drawings.find((d) => d.onderdeel === part.naam);
      const sameFase = drawings.filter((d) => d.fase === part.fase);
      const n = counters.get(part.fase) ?? 0;
      counters.set(part.fase, n + 1);
      const template = sameName ?? sameFase[n % Math.max(1, sameFase.length)] ?? drawings[0]!;
      return {
        ...template,
        datum: day.datum,
        onderdeel: part.naam,
        fase: part.fase,
        organisatie: part.organisatie,
        coachingspunten: part.coachingspunten,
        tekening: { ...template.tekening, titel: part.naam },
      };
    }),
  );
  return { ...example, oefeningen };
}
