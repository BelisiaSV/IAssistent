import type { BankExercise, LibraryExercise, RoleContext } from "../context";
import type { CollaborationInput } from "../collaboration";
import type { ConversationInput } from "../conversation";
import { COLLABORATION_TASK, CONVERSATION_TASK, MEETING_TASK, QUALITY_TASK } from "../layout";
import type { MeetingInput, MeetingOutput, MeetingWeekPlan, WeekPlanDay } from "../meeting";
import { roleExample, roleTask } from "../prompt";
import type { Staff, StaffRole } from "../types";
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
  async generate({ staff, role, task, context: input }) {
    if (task === CONVERSATION_TASK) return { output: conversationExample(role, input as ConversationInput), provider: "example", model: null, usage: null };
    if (task === MEETING_TASK) return { output: meetingExample(role, input as MeetingInput), provider: "example", model: null, usage: null };
    if (task === COLLABORATION_TASK) return { output: collaborationExample(role, input as CollaborationInput), provider: "example", model: null, usage: null };
    // Quality check: the example of the task as it is (its criteria match _gedeeld/kwaliteit.json).
    if (task === QUALITY_TASK) {
      const example = roleExample(role, task);
      if (!example) throw new StaffGenerationError("provider_error", `role ${role.id} (${task}) has no example`);
      return { output: example, provider: "example", model: null, usage: null };
    }
    const context = input as RoleContext;
    const example = roleExample(role, task) as Example | null;
    if (!example) {
      throw new StaffGenerationError("provider_error", `role ${role.id} (${task}) has no example`);
    }
    let output: Example;
    if (Array.isArray(example.dagen)) output = fitWeek(example, context, staff);
    else if (example.speelplan && example.trainingsaccenten) output = fitTacticalWeek(example, context, staff);
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
  const withSetPieces = setPieceTraining(dagen, days, context);
  return { ...example, ...extra, dagen: fromLibrary(withSetPieces, context, staff), individueel: fitIndividual(example, context) };
}

type SetPiecePart = Record<string, unknown> & { fase: string; standaardsituaties?: string[] };

/**
 * Assistant Coach: the set pieces of the Tactical Coach's week plan are trained
 * in the example's set-piece part (a part with titles in `standaardsituaties`).
 * When the week has no training with such a part, it replaces the last kern
 * part of the last training before the match.
 */
function setPieceTraining(days: Example[], exampleDays: Day[], context: RoleContext): Example[] {
  const plan = context.staf["tactical-coach"] as { standaardsituaties?: { titel: string }[] } | undefined;
  const titles = plan?.standaardsituaties?.map((s) => s.titel) ?? [];
  const parts = (d: Example) => (Array.isArray(d.onderdelen) ? (d.onderdelen as SetPiecePart[]) : null);
  const isSetPiecePart = (p: SetPiecePart) => (p.standaardsituaties?.length ?? 0) > 0;
  // Without a week plan there are no set pieces to train: the example's titles do not apply.
  const result = days.map((d) => {
    const list = parts(d);
    return list ? { ...d, onderdelen: list.map((p) => (isSetPiecePart(p) ? { ...p, standaardsituaties: titles } : p)) } : d;
  });
  if (!titles.length || result.some((d) => parts(d)?.some(isSetPiecePart))) return result;

  const template = exampleDays.flatMap((d) => parts(d) ?? []).find(isSetPiecePart);
  const match = context.weekinput.dagen.find((d) => d.wedstrijd)?.datum ?? null;
  const target = [...result]
    .reverse()
    .find((d) => d.soort === "training" && (!match || (d.datum as string) < match) && parts(d)?.some((p) => p.fase === "kern"));
  if (!template || !target) return result;
  const list = parts(target)!;
  const last = list.map((p) => p.fase).lastIndexOf("kern");
  target.onderdelen = list.map((p, i) => (i === last ? { ...template, standaardsituaties: titles } : p));
  return result;
}

type Part = Record<string, unknown> & {
  fase: string;
  duur_min: number;
  reeksen: number | null;
  rpe: number | null;
  oefening_id?: string | null;
  bank_nummer?: string | null;
};

/**
 * A core part based on an exercise of the platform's exercise bank: its name,
 * goal, organisation and coaching points; the load stays the example's.
 */
function bankPart<T extends object>(part: T, exercise: BankExercise): T {
  const p = part as Record<string, unknown>;
  return {
    ...part,
    oefening_id: null,
    bank_nummer: exercise.nummer,
    naam: exercise.titel,
    ...("doel" in p ? { doel: exercise.hoofddoel || p.doel } : {}),
    organisatie: exercise.organisatie.length ? exercise.organisatie.join(" ") : p.organisatie,
    spelers: exercise.aantal_spelers || p.spelers,
    coachingspunten: exercise.coachingspunten.length ? exercise.coachingspunten : p.coachingspunten,
  } as T;
}

/** Picks bank exercises in the given order (best fit first), each at most once. */
function bankPicker(bank: BankExercise[]) {
  const used = new Set<string>();
  return () => {
    const next = bank.find((e) => !used.has(e.nummer));
    if (next) used.add(next.nummer);
    return next;
  };
}

/**
 * Assistant Coach: fills the parts of each training with exercises from the
 * coach's library (same phase, enough players, not yet used this week) and
 * scales their sets with the reeksen_factor of the week type and match day.
 * Parts without a fitting exercise keep the example (oefening_id null).
 */
function fromLibrary(days: Example[], context: RoleContext, staff: Staff): Example[] {
  // Without a squad there is nothing to check the number of players against.
  const players = context.kern.filter((p) => p.beschikbaar).length;
  const usable = context.bibliotheek.filter(
    (e) => e.soort === "oefening" && (!players || e.spelers.min === null || e.spelers.min <= players),
  );
  // Then the exercise bank of the platform, for core parts the library cannot fill.
  const fromBank = bankPicker(context.oefenstofbank ?? []);

  const weekFactor = context.weekinput.periodisering.weektype?.reeksen_factor ?? 1;
  const physical = context.staf["physical-coach"] as { dagen?: { datum: string; rpe_doel: number | null }[] } | undefined;
  // Variation: an exercise is used at most once per week.
  const used = new Set<string>();

  return days.map((d) => {
    if (!Array.isArray(d.onderdelen)) return d;
    const input = context.weekinput.dagen.find((x) => x.datum === d.datum);
    const factor = weekFactor * (staff.matchDays.dagen.find((m) => m.code === d.md)?.reeksen_factor ?? 1);
    const maxRpe = physical?.dagen?.find((x) => x.datum === d.datum)?.rpe_doel ?? null;

    const parts: (Part & { _ex?: LibraryExercise })[] = (d.onderdelen as Part[]).map((part) => {
      // The set-piece part trains the Tactical Coach's set pieces, not a library exercise.
      if (((part.standaardsituaties as string[] | undefined)?.length ?? 0) > 0) return { ...part, oefening_id: null, bank_nummer: null };
      const exercise = usable.find((e) => (e.fase === part.fase || e.fase === null) && !used.has(e.id));
      if (!exercise) {
        const bank = part.fase === "kern" ? fromBank() : undefined;
        return bank ? bankPart(part, bank) : { ...part, oefening_id: null, bank_nummer: null };
      }
      used.add(exercise.id);
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
    bank_nummer: null,
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
function fitTacticalWeek(example: Example, context: RoleContext, staff: Staff): Example {
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
    standaardsituaties: ownSetPieces(example.standaardsituaties as SetPiece[], context, staff),
  };
}

/**
 * Tactical Coach: the coach's own set pieces first (roles filled in with
 * available field players), plus at most one new one from the example for a
 * type the coach has none of. Without own set pieces, the example stays.
 */
function ownSetPieces(examples: SetPiece[], context: RoleContext, staff: Staff): SetPiece[] {
  const schema = staff.roles.find((r) => r.id === "tactical-coach")?.outputSchema as
    | { properties?: { standaardsituaties?: { items?: { properties?: { soort?: { enum?: string[] } } } } } }
    | undefined;
  const types = schema?.properties?.standaardsituaties?.items?.properties?.soort?.enum ?? [];
  const own = context.bibliotheek.filter(
    (e): e is LibraryExercise & { standaardsituatie: NonNullable<LibraryExercise["standaardsituatie"]> } =>
      e.soort === "standaardsituatie" && !!e.standaardsituatie && types.includes(e.standaardsituatie.type),
  );
  if (!own.length) return examples;

  const field = context.kern.filter((p) => p.beschikbaar && p.rugnummer !== null && !p.posities.includes("GK"));
  const chosen = own.slice(0, 8).map((e) => {
    const template = examples.find((x) => x.soort === e.standaardsituatie.type) ?? examples[0]!;
    const taken = e.standaardsituatie.rollen.flatMap((r, i) => {
      const player = field[i];
      return player ? [{ rugnummer: player.rugnummer!, taak: r.vereiste ? `${r.rol} (${r.vereiste})` : r.rol }] : [];
    });
    return {
      ...template,
      standaardsituatie_id: e.id,
      titel: e.titel,
      soort: e.standaardsituatie.type,
      afspraken: e.verloop.length ? e.verloop : (template.afspraken as string[]),
      taken: taken.length ? taken : template.taken,
      tekening: { ...(template.tekening as Example), titel: e.titel },
    };
  });
  const covered = new Set(chosen.map((s) => s.soort));
  const extra = examples.find((x) => !covered.has(x.soort as string));
  return extra ? [...chosen, { ...extra, standaardsituatie_id: null }] : chosen;
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
  // Bank exercises with their own drawing or video need no new drawing.
  const withPicture = new Set((context.oefenstofbank ?? []).filter((e) => e.beeld).map((e) => e.nummer));
  const planning = context.staf["assistant-coach"] as
    | {
        dagen?: {
          datum: string;
          onderdelen?: { oefening_id?: string | null; bank_nummer?: string | null; standaardsituaties?: string[]; naam: string; fase: string; organisatie: string; coachingspunten: string[] }[];
        }[];
      }
    | undefined;
  if (!planning?.dagen) {
    throw new StaffGenerationError("provider_error", "no week planning of the Assistant Coach");
  }
  const drawings = example.oefeningen as (Example & { onderdeel: string; fase: string; tekening: Example })[];
  const counters = new Map<string, number>();
  const oefeningen = planning.dagen.flatMap((day) =>
    (day.onderdelen ?? []).filter((part) => !part.oefening_id && !part.standaardsituaties?.length && !withPicture.has(part.bank_nummer ?? "")).map((part) => {
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

/**
 * Test mode for a conversation: the examples of the role take turns, so a
 * conversation shows every example once before the first comes back.
 */
function conversationExample(role: StaffRole, input: ConversationInput): unknown {
  const examples = (roleTask(role, CONVERSATION_TASK)?.examples ?? []).filter((f) => f.path.endsWith(".json")).sort((a, b) => a.path.localeCompare(b.path));
  if (!examples.length) throw new StaffGenerationError("provider_error", `role ${role.id} has no conversation example`);
  const asked = input.gesprek.filter((t) => t.van === "hoofdcoach").length;
  return JSON.parse(examples[asked % examples.length]!.content);
}

/** Test mode for a joint task: the example of the role for this phase (bijdrage or eindvoorstel). */
function collaborationExample(role: StaffRole, input: CollaborationInput): unknown {
  const examples = (roleTask(role, COLLABORATION_TASK)?.examples ?? []).filter((f) => f.path.endsWith(".json"));
  const example = examples.find((f) => f.path.split("/").pop()!.startsWith(input.fase)) ?? examples[0];
  if (!example) throw new StaffGenerationError("provider_error", `role ${role.id} has no collaboration example`);
  return JSON.parse(example.content);
}

/**
 * Test mode for the staff meeting: the example of the role for this kind of
 * turn. A role that speaks a second time with the same kind gets its next
 * example (reactie-2.json, …) when there is one.
 */
function meetingExample(role: StaffRole, input: MeetingInput): unknown {
  const examples = (roleTask(role, MEETING_TASK)?.examples ?? []).filter((f) => f.path.endsWith(".json"));
  const ofKind = examples
    .filter((f) => {
      const name = f.path.split("/").pop()!;
      return name === `${input.soort}.json` || name.startsWith(`${input.soort}-`);
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const earlier = input.gesprek.filter((t) => t.van === role.id).length;
  const example = ofKind[Math.min(earlier, ofKind.length - 1)] ?? ofKind[0] ?? examples[0];
  if (!example) throw new StaffGenerationError("provider_error", `role ${role.id} has no staff meeting example`);
  const output = JSON.parse(example.content) as MeetingOutput;
  const plan = output.overzicht?.weekplan;
  return plan ? { ...output, overzicht: { ...output.overzicht!, weekplan: fitMeetingWeek(plan, input.teamcontext) } } : output;
}

type ContextDay = {
  datum: string;
  weekdag: string;
  md: string | null;
  training: { aanvang: string; duur_min: number } | null;
  wedstrijd: { aanvang: string | null } | null;
};
type ContextPlayer = { rugnummer: number | null; beschikbaar: boolean; status: string; terug_verwacht: string | null; geschorst_wedstrijden?: number };

/**
 * Fits the example week onto the week in the team context: every day of the
 * week, the example trainings on the training days (the last example training
 * on the last training before the match), the match on match days, rest on the
 * others; availability from the squad. The content comes from the example.
 */
function fitMeetingWeek(plan: MeetingWeekPlan, teamcontext: Record<string, unknown>): MeetingWeekPlan {
  const week = teamcontext.week as { week_van?: string; dagen?: ContextDay[] } | undefined;
  const days = week?.dagen ?? [];
  if (!days.length) return plan;
  const trainings = plan.dagen.filter((d) => d.soort === "training");
  const match = plan.dagen.find((d) => d.soort === "wedstrijd");
  const rest = plan.dagen.find((d) => d.soort === "rust");
  const trainingDays = days.filter((d) => d.training);
  // Core parts take an exercise of the exercise bank that fits the assignment, each once.
  const fromBank = bankPicker((teamcontext.oefenstofbank as BankExercise[] | undefined) ?? []);
  const withBank = (day: WeekPlanDay): WeekPlanDay => ({
    ...day,
    onderdelen: day.onderdelen.map((part) => {
      if (part.oefening_id || part.fase !== "kern") return { ...part, bank_nummer: part.bank_nummer ?? null };
      const bank = fromBank();
      return bank ? bankPart(part, bank) : { ...part, bank_nummer: part.bank_nummer ?? null };
    }),
  });
  const dagen = days.map((day): WeekPlanDay => {
    const base = { datum: day.datum, weekdag: day.weekdag, md: day.md };
    if (day.wedstrijd && match) return { ...match, ...base, tijdstip: day.wedstrijd.aanvang ?? match.tijdstip };
    if (day.training && trainings.length) {
      // Align from the end: the last training of the week gets the last example training.
      const fromEnd = trainingDays.length - 1 - trainingDays.indexOf(day);
      const template = trainings[Math.max(0, trainings.length - 1 - fromEnd)]!;
      return withBank({ ...template, ...base, tijdstip: day.training.aanvang, totale_duur_min: day.training.duur_min });
    }
    return rest ? { ...rest, ...base } : { ...base, soort: "rust", titel: "", doel: "", tijdstip: null, totale_duur_min: null, belasting: "rust", onderdelen: [], opmerking: null };
  });
  const players = (teamcontext.kern as ContextPlayer[] | undefined) ?? [];
  const unavailable = players.filter((p) => !p.beschikbaar || (p.geschorst_wedstrijden ?? 0) > 0);
  const byDate = new Map(plan.spelersplanning.map((s) => [s.weekdag, s]));
  return {
    week_van: week?.week_van ?? plan.week_van,
    beschikbaarheid: players.length
      ? {
          beschikbaar: players.length - unavailable.length,
          niet_beschikbaar: unavailable.map((p) => ({ rugnummer: p.rugnummer, reden: p.status, terug_verwacht: p.terug_verwacht, aanpassing: null })),
        }
      : plan.beschikbaarheid,
    dagen,
    spelersplanning: dagen.map((day) => {
      const template = byDate.get(day.weekdag);
      return {
        datum: day.datum,
        weekdag: day.weekdag,
        activiteit: day.soort === "rust" ? (rest?.titel ?? "") : day.titel,
        aanvang: day.tijdstip,
        opmerking: day.soort === "training" || day.soort === "wedstrijd" ? (template?.opmerking ?? null) : null,
      };
    }),
  };
}
