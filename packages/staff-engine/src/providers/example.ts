import type { LibraryExercise, RoleContext } from "../context";
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
    if (Array.isArray(example.dagen)) output = fitWeek(example, context, staff);
    else if (example.speelplan && example.trainingsaccenten) output = fitTacticalWeek(example, context);
    else if (example.opstelling && example.wedstrijdbespreking) output = fitMatchPrep(example, context, staff);
    else if (Array.isArray(example.oefeningen)) output = fitDrawings(example, context);
    else output = example;
    return { output, provider: "example", model: null, usage: null };
  },
};

/** Week-shaped outputs (Assistant Coach, Physical Coach). */
function fitWeek(example: Example, context: RoleContext, staff: Staff): Example {
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
  return { ...example, ...extra, dagen: fromLibrary(dagen, context, staff), individueel: fitIndividual(example, context) };
}

type Part = Record<string, unknown> & { fase: string; duur_min: number; reeksen: number | null; rpe: number | null; oefening_id?: string | null };

/**
 * Assistant Coach: fills the parts of each training with exercises from the
 * coach's library (same phase, enough players, not yet used this week) and
 * scales their sets with the reeksen_factor of the week type and match day.
 * Parts without a fitting exercise keep the example (oefening_id null).
 */
function fromLibrary(days: Example[], context: RoleContext, staff: Staff): Example[] {
  const players = context.kern.filter((p) => p.beschikbaar).length;
  const usable = context.bibliotheek.filter((e) => e.spelers.min === null || e.spelers.min <= players);
  if (!usable.length) return days.map((d) => (Array.isArray(d.onderdelen) ? { ...d, onderdelen: (d.onderdelen as Part[]).map((o) => ({ ...o, oefening_id: null })) } : d));

  const weekFactor = context.weekinput.periodisering.weektype?.reeksen_factor ?? 1;
  const physical = context.staf["physical-coach"] as { dagen?: { datum: string; rpe_doel: number | null }[] } | undefined;
  const used = new Map<string, number>();

  return days.map((d) => {
    if (!Array.isArray(d.onderdelen)) return d;
    const input = context.weekinput.dagen.find((x) => x.datum === d.datum);
    const factor = weekFactor * (staff.matchDays.dagen.find((m) => m.code === d.md)?.reeksen_factor ?? 1);
    const maxRpe = physical?.dagen?.find((x) => x.datum === d.datum)?.rpe_doel ?? null;

    const parts: (Part & { _ex?: LibraryExercise })[] = (d.onderdelen as Part[]).map((part) => {
      const candidates = usable.filter((e) => e.fase === part.fase || e.fase === null);
      if (!candidates.length) return { ...part, oefening_id: null };
      const exercise = [...candidates].sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0))[0]!;
      used.set(exercise.id, (used.get(exercise.id) ?? 0) + 1);
      return libraryPart(part, exercise, factor, maxRpe);
    });

    // Too long for the training: drop sets from the longest library part.
    const budget = input?.training?.duur_min ?? null;
    const total = () => parts.reduce((sum, p) => sum + p.duur_min, 0);
    while (budget !== null && total() > budget) {
      const longest = parts
        .filter((p): p is Part & { _ex: LibraryExercise } => !!p._ex && p._ex.werk_min !== null && (p.reeksen ?? 0) > 1)
        .sort((a, b) => b.duur_min - a.duur_min)[0];
      if (!longest) break;
      Object.assign(longest, setsAndDuration(longest._ex, longest.reeksen! - 1, factor));
    }
    return { ...d, onderdelen: parts.map(({ _ex, ...p }) => p) };
  });
}

/** A part of the planning built from a library exercise, scaled to the day. */
function libraryPart(part: Part, exercise: LibraryExercise, factor: number, maxRpe: number | null): Part & { _ex?: LibraryExercise } {
  const sets = exercise.reeksen !== null ? Math.max(1, Math.round(exercise.reeksen * factor)) : null;
  const rpe = exercise.rpe ?? part.rpe;
  return {
    ...part,
    oefening_id: exercise.id,
    naam: exercise.titel,
    doel: exercise.labels.length ? exercise.labels.join(", ") : part.doel,
    organisatie: exercise.organisatie ?? part.organisatie,
    spelers: playerRange(exercise) ?? part.spelers,
    coachingspunten: exercise.coachingspunten.length ? exercise.coachingspunten : part.coachingspunten,
    intensiteit: exercise.intensiteit ?? part.intensiteit,
    rpe: rpe !== null && maxRpe !== null ? Math.min(rpe, maxRpe) : rpe,
    ...setsAndDuration(exercise, sets, factor, part.duur_min),
    _ex: exercise,
  };
}

function setsAndDuration(exercise: LibraryExercise, sets: number | null, factor: number, fallback?: number) {
  const minutes = (n: number) => `${String(n).replace(".", ",")} min`;
  if (sets !== null && exercise.werk_min !== null) {
    const rest = exercise.rust_min ?? 0;
    return {
      reeksen: sets,
      werk_per_reeks: minutes(exercise.werk_min),
      rust_tussen_reeksen: sets > 1 && rest > 0 ? minutes(rest) : null,
      duur_min: Math.ceil(sets * exercise.werk_min + (sets - 1) * rest),
    };
  }
  const base = exercise.duur_min ?? fallback ?? 0;
  return { reeksen: sets, werk_per_reeks: null, rust_tussen_reeksen: null, duur_min: Math.max(1, Math.round(base * factor)) };
}

function playerRange(exercise: LibraryExercise): string | null {
  const { min, max } = exercise.spelers;
  if (min === null && max === null) return null;
  return min === max || max === null ? String(min) : min === null ? `≤ ${max}` : `${min}-${max}`;
}

function fitIndividual(example: Example, context: RoleContext) {
  const advice = (example.individueel ?? []) as { advies: string }[];
  return context.kern
    .filter((p) => !p.beschikbaar && p.rugnummer !== null)
    .map((p, i) => ({ rugnummer: p.rugnummer!, advies: advice.length ? advice[i % advice.length]!.advies : "" }));
}

/** Tactical Coach week plan: opponent from the context, accents on the training days. */
function fitTacticalWeek(example: Example, context: RoleContext): Example {
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
    trainingsaccenten,
  };
}

type SetPiece = { taken: { rugnummer: number; taak: string }[] } & Example;

/**
 * Tactical Coach match preparation: lineup from the available squad; set pieces
 * from the week plan (staf), with tasks only for players in the lineup.
 */
function fitMatchPrep(example: Example, context: RoleContext, staff: Staff): Example {
  const lineup = example.opstelling as { formatie: string; basis: { post: string; taak: string }[]; bank: number[]; toelichting: string };
  const weekPlan = context.staf["tactical-coach"] as { speelplan?: { formatie?: string }; standaardsituaties?: SetPiece[] } | undefined;
  const formation =
    staff.formations.formaties.find((f) => f.code === weekPlan?.speelplan?.formatie) ??
    staff.formations.formaties.find((f) => f.code === lineup.formatie);
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

  const starters = basis.map((b) => b.rugnummer);
  const setPieces = (weekPlan?.standaardsituaties ?? (example.standaardsituaties as SetPiece[])).map((sp) => ({
    ...sp,
    taken: sp.taken.map((t, i) => ({ ...t, rugnummer: starters.includes(t.rugnummer) ? t.rugnummer : starters[i % Math.max(1, starters.length)]! })),
  }));

  return {
    ...example,
    opstelling: { ...lineup, formatie: formation?.code ?? lineup.formatie, basis, bank },
    standaardsituaties: setPieces,
  };
}

/** Tactical Coach drawings: one drawing per part of the approved Assistant Coach planning. */
function fitDrawings(example: Example, context: RoleContext): Example {
  const planning = context.staf["assistant-coach"] as
    | { dagen?: { datum: string; onderdelen?: { oefening_id?: string | null; naam: string; fase: string; organisatie: string; coachingspunten: string[] }[] }[] }
    | undefined;
  if (!planning?.dagen) {
    throw new StaffGenerationError("provider_error", "no week planning of the Assistant Coach");
  }
  const drawings = example.oefeningen as (Example & { onderdeel: string; fase: string; tekening: Example })[];
  const counters = new Map<string, number>();
  const oefeningen = planning.dagen.flatMap((day) =>
    (day.onderdelen ?? []).filter((part) => !part.oefening_id).map((part) => {
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
