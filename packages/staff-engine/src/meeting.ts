import { MEETING_TASK, SHARED_TEXT_FILES } from "./layout";
import { validateOutput } from "./output";
import { renderTemplate, roleTask, sharedText } from "./prompt";
import { StaffGenerationError, type GenerateResult, type StaffModelProvider } from "./providers/types";
import type { MeetingTurnKind } from "./shared/meeting";
import type { Staff } from "./types";

/**
 * A staff meeting in the Staff Room: the head coach gives one assignment and
 * the roles speak in turn (order in _gedeeld/staffkamer.json), reacting to
 * each other, until one role writes the joint overview. Keys are Dutch
 * because this data goes to the AI as-is. No names of players or opponents.
 */
export interface WeekPlanPart {
  oefening_id: string | null;
  /** Number of the exercise in the platform's exercise bank (e.g. OEF-007), if the part is based on one. */
  bank_nummer: string | null;
  fase: "opwarming" | "kern" | "afsluiting";
  naam: string;
  organisatie: string;
  spelers: string;
  duur_min: number;
  reeksen: number | null;
  werk_per_reeks: string | null;
  rust_tussen_reeksen: string | null;
  intensiteit: "laag" | "matig" | "hoog" | "maximaal";
  rpe: number | null;
  coachingspunten: string[];
}

export interface WeekPlanDay {
  datum: string;
  weekdag: string;
  md: string | null;
  soort: "training" | "wedstrijd" | "rust";
  titel: string;
  doel: string;
  tijdstip: string | null;
  totale_duur_min: number | null;
  belasting: "rust" | "laag" | "matig" | "hoog" | "zeer hoog";
  onderdelen: WeekPlanPart[];
  opmerking: string | null;
}

/** The full week that comes out of a meeting about the (training) week. */
export interface MeetingWeekPlan {
  week_van: string;
  beschikbaarheid: {
    beschikbaar: number;
    niet_beschikbaar: { rugnummer: number | null; reden: string; terug_verwacht: string | null; aanpassing: string | null }[];
  };
  dagen: WeekPlanDay[];
  spelersplanning: { datum: string; weekdag: string; activiteit: string; aanvang: string | null; opmerking: string | null }[];
}

export interface MeetingOverview {
  titel: string;
  samenvatting: string;
  onderdelen: { titel: string; inhoud: string; rol: string | null }[];
  aandachtspunten: string[];
  /** The full week, when the assignment is about the (training) week; else null. */
  weekplan: MeetingWeekPlan | null;
}

export interface MeetingOutput {
  /** The message of the role in the group chat. */
  bericht: string;
  /** Who the role speaks to: a role id, "hoofdcoach" or null (everyone). */
  aan: string | null;
  /** Only for the turn "overzicht": the joint overview for the head coach. */
  overzicht: MeetingOverview | null;
}

export interface MeetingInput {
  teamcontext: Record<string, unknown>;
  /** The assignment of the head coach, in his words. */
  opdracht: string;
  soort: MeetingTurnKind;
  /** Earlier messages of this meeting, oldest first. */
  gesprek: { van: string; bericht: string; aan: string | null }[];
  /** The previous overview and what the head coach wants changed, or null. */
  feedback: { vorig_overzicht: MeetingOverview; feedback: string } | null;
}

export interface MeetingResult extends Omit<GenerateResult, "output"> {
  output: MeetingOutput;
  contentVersion: string;
}

/** Whether a role can speak in the staff meeting (it has the meeting task in /staff). */
export function canMeet(staff: Staff, roleId: string): boolean {
  const role = staff.roles.find((r) => r.id === roleId);
  return !!role && !!roleTask(role, MEETING_TASK);
}

/** The turns of a meeting from /staff, without roles that cannot speak. */
export function meetingTurns(staff: Staff) {
  return staff.meeting.beurten
    .filter((t) => canMeet(staff, t.rol))
    .map((t, i) => ({ position: i + 1, role: t.rol, kind: t.soort }));
}

/**
 * One turn of a role in the staff meeting: builds the prompt from the /staff
 * templates, asks the provider and validates the output.
 */
export async function runMeetingTurn(
  staff: Staff,
  roleId: string,
  input: MeetingInput,
  provider: StaffModelProvider,
): Promise<MeetingResult> {
  const role = staff.roles.find((r) => r.id === roleId);
  const task = role ? roleTask(role, MEETING_TASK) : null;
  if (!role || !task) throw new StaffGenerationError("role_not_ready", `role ${roleId} cannot speak in the staff meeting`);

  const example =
    task.examples.find((f) => f.path.split("/").pop() === `${input.soort}.json`) ?? task.examples.find((f) => f.path.endsWith(".json"));
  const system = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.meetingSystemTemplate), {
    afspraken: sharedText(staff, SHARED_TEXT_FILES.agreements),
    visie_afspraken: sharedText(staff, SHARED_TEXT_FILES.visionAgreements),
    rol: role.description.trim(),
    instructies: task.instructions.trim(),
    rollen: JSON.stringify(staff.roles.map((r) => ({ id: r.id, naam: r.meta.naam })), null, 2),
    voorbeeld: example ? example.content.trim() : "null",
  });
  const user = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.meetingUserTemplate), {
    teamcontext: JSON.stringify(input.teamcontext, null, 2),
    opdracht: input.opdracht,
    soort: input.soort,
    gesprek: JSON.stringify(input.gesprek, null, 2),
    feedback: JSON.stringify(input.feedback, null, 2),
  });

  const result = await provider.generate({ staff, role, task: task.id, outputSchema: task.outputSchema, system, user, context: input });
  const validation = validateOutput(task.outputSchema, result.output);
  if (!validation.ok) {
    throw new StaffGenerationError("invalid_output", "output does not match output-schema.json", validation.errors);
  }
  const output = result.output as MeetingOutput;
  if (input.soort === "overzicht" && !output.overzicht) {
    throw new StaffGenerationError("invalid_output", "the overview turn has no overview", ["overzicht ontbreekt"]);
  }
  return {
    output: { ...output, overzicht: input.soort === "overzicht" ? output.overzicht : null },
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    contentVersion: role.meta.versie,
  };
}
