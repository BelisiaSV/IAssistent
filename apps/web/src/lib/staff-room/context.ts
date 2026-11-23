import "server-only";

import type { Tables } from "@iassistent/db";
import type { VisionAnswers } from "@iassistent/staff-engine/content";

import { clubDnaForTeam } from "@/lib/clubs/dna";
import { clubExercisesForStaff } from "@/lib/clubs/exercises-staff";
import { loadDevelopment, recurring } from "@/lib/development/load";
import { bankForStaff } from "@/lib/exercise-bank/load";
import { LIBRARY_COLUMNS, LIBRARY_LIMIT, libraryExercise } from "@/lib/exercises/library";
import { messages } from "@/lib/messages";
import { matchEvaluations } from "@/lib/opponents/context";
import { withoutNames } from "@/lib/proposals/names";
import { formOf, nextMatchOf, opponentOf } from "@/lib/competition/team";
import { cardRules, suspensions, yellowCounts } from "@/lib/players/cards";
import { matchDayCatalog, periodizationCatalog, testCatalog, visionQuestionnaire } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";
import { ageCategory } from "@/lib/teams/age-categories";
import { teamFormation } from "@/lib/teams/formation";
import { buildRoleContext } from "@/lib/weeks/context";
import { addDays, isoWeekday, mondayOf, todayInBelgium } from "@/lib/weeks/dates";
import { trainingScheduleSchema } from "@/lib/weeks/validation";
import { contextForRole, loadWeek } from "@/lib/weeks/load";

import { turnOutput } from "./meetings";
import { stepOutput } from "./tasks";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Evaluations that go along (the most recent ones). */
const EVALUATIONS = 10;
/** Approved joint tasks that go along (the most recent ones). */
const APPROVED_TASKS = 5;
/** Approved staff meetings that go along (the most recent ones). */
const APPROVED_MEETINGS = 3;

/**
 * The approved context of a team that every role in the Staff Room may read:
 * the team, the vision of the head coach, the squad (shirt numbers, no names),
 * this week, the approved plans of this week, the approved joint tasks and
 * staff meetings, suspensions from cards, the exercise library and the
 * exercises of the platform's bank that fit the question best. Built
 * with the same helpers as the week tasks, so the same privacy rules apply.
 */
export async function teamContextForChat(supabase: Supabase, team: Tables<"teams">, coachId: string, question = "") {
  const today = todayInBelgium();
  // On Sunday the staff already looks ahead to the next week.
  const weekStart = isoWeekday(today) === 7 ? addDays(mondayOf(today), 7) : mondayOf(today);
  const schedule = trainingScheduleSchema.safeParse(team.training_schedule);
  const divisions = team.federation_team ? team.federation_divisions : [];
  const [clubDna, club, data, { data: profile }, { data: exercises }, { data: tasks }, { data: meetings }, { data: cards }, { data: reports }, { data: weeks }, { data: competitionMatches }, { data: standings }] = await Promise.all([
    clubDnaForTeam(supabase, team),
    clubExercisesForStaff(supabase, team, question),
    loadWeek(supabase, team, weekStart),
    supabase.from("coach_profiles").select("vision_summary, vision").eq("coach_id", coachId).maybeSingle(),
    supabase
      .from("exercises")
      .select(LIBRARY_COLUMNS)
      .eq("use_in_planning", true)
      .order("updated_at", { ascending: false })
      .limit(LIBRARY_LIMIT),
    supabase
      .from("staff_tasks")
      .select("title, version, decided_at, staff_task_steps(version, phase, output)")
      .eq("team_id", team.id)
      .eq("status", "approved")
      .order("decided_at", { ascending: false })
      .limit(APPROVED_TASKS),
    supabase
      .from("staff_meetings")
      .select("assignment, version, decided_at, staff_meeting_turns(version, kind, output)")
      .eq("team_id", team.id)
      .eq("status", "approved")
      .order("decided_at", { ascending: false })
      .limit(APPROVED_MEETINGS),
    supabase.from("player_cards").select("player_id, match_date, card").eq("team_id", team.id),
    supabase.from("match_reports").select("match_date").eq("team_id", team.id).lte("match_date", today),
    supabase.from("week_plans").select("matches").eq("team_id", team.id).lte("week_start", today),
    divisions.length
      ? supabase.from("competition_matches").select("*").in("division", divisions)
      : Promise.resolve({ data: [] as Tables<"competition_matches">[] }),
    divisions.length
      ? supabase.from("competition_standings").select("*").in("division", divisions).eq("period", 0)
      : Promise.resolve({ data: [] as Tables<"competition_standings">[] }),
  ]);

  // Approved work of this week, per role (and task when it is not the default one).
  const approved = Object.fromEntries(
    data.proposals
      .filter((p) => p.status === "approved" && p.output)
      .map((p) => [p.task === "default" ? p.role : `${p.role}/${p.task}`, p.output]),
  );
  const vision = profile ? { summary: profile.vision_summary, vision: profile.vision } : null;
  const bank = await bankForStaff(supabase, question, club.recommendedBank);
  const library = (exercises ?? []).map(libraryExercise);

  const context = data.week
    ? contextForRole(data, weekStart, { staff: approved, vision, feedback: null, library, clubDna })
    : buildRoleContext({
        weekStart,
        // No week input yet: the fixed training days of the team.
        trainings: (schedule.success ? schedule.data : []).map((slot) => ({
          date: addDays(weekStart, slot.weekday - 1),
          start: slot.start,
          duration_min: slot.duration_min,
        })),
        matches: [],
        previousMatchDate: null,
        notes: null,
        players: data.players,
        visionSummary: vision?.summary ?? null,
        visionAnswers: ((vision?.vision ?? {}) as { antwoorden?: VisionAnswers }).antwoorden ?? {},
        questionnaire: visionQuestionnaire,
        matchDays: matchDayCatalog,
        periodization: periodizationCatalog,
        season: data.season,
        tests: testCatalog,
        testResults: data.testResults,
        history: data.history,
        opponent: null,
        evaluations: matchEvaluations(data.reports.filter((r) => r.match_date < weekStart).slice(0, EVALUATIONS), null),
        library,
        staff: approved,
        feedback: null,
        clubDna,
      });

  // Cards: yellow cards this season and who is suspended for the next match.
  const played = [
    ...(reports ?? []).map((r) => r.match_date),
    ...(weeks ?? []).flatMap((w) => ((w.matches ?? []) as { date?: string }[]).flatMap((m) => (m.date && m.date <= today ? [m.date] : []))),
  ];
  const since = team.competition_start_date;
  const suspended = suspensions(cards ?? [], played, cardRules(team), since);
  const yellows = yellowCounts(cards ?? [], since);
  const byNumber = new Map(data.players.filter((p) => !p.archived_at && p.shirt_number !== null).map((p) => [p.shirt_number, p.id]));
  const kern = context.kern.map((k) => {
    const id = byNumber.get(k.rugnummer);
    const ban = id ? suspended.get(id) : undefined;
    const isSuspended = (ban?.matches ?? 0) > 0;
    return {
      ...k,
      ...(isSuspended ? { beschikbaar: false, status: messages.players.status.suspended.toLowerCase() } : {}),
      gele_kaarten: (id && yellows.get(id)) || 0,
      geschorst_wedstrijden: ban?.matches ?? 0,
    };
  });

  // Development: open team goals, recurring attention points and the average rating of the last 8 weeks.
  const development = await loadDevelopment(supabase, [team.id], addDays(today, -56), today);
  const anonymous = (text: string) => withoutNames(text, data.players, messages.staffRoom.unknownPlayer);
  const ratings = (development?.evaluations ?? []).flatMap((e) => (e.rating ? [e.rating] : []));

  return {
    ontwikkeling: development
      ? {
          teamdoelen: development.goals
            .filter((g) => g.status !== "dropped")
            .map((g) => ({ titel: anonymous(g.title), status: g.status, voortgang_pct: g.progress, streefdatum: g.target_date })),
          terugkerende_aandachtspunten: recurring(development.evaluations).map((p) => ({ punt: p.naam, keer: p.aantal })),
          gemiddelde_beoordeling_trainingen: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
        }
      : null,
    competitie: competitionContext(team.federation_team, competitionMatches ?? [], standings ?? [], today),
    team: { leeftijdscategorie: ageCategory(team.age_category), standaardformatie: teamFormation(team.default_formation).code },
    visie: context.visie,
    week: { ...context.weekinput, weekinput_ingevuld: !!data.week },
    kern,
    schorsingsregels: { gele_kaarten_per_schorsing: team.yellow_card_limit, wedstrijden_bij_gele_kaarten: team.yellow_card_ban, wedstrijden_bij_rode_kaart: team.red_card_ban },
    testen: context.testen,
    tegenstander: context.tegenstander,
    evaluaties: context.evaluaties,
    bibliotheek: context.bibliotheek,
    cluboefenstof: club.exercises,
    oefenstofbank: bank,
    goedgekeurd: context.staf,
    goedgekeurde_taken: (tasks ?? []).flatMap((task) => {
      const final = stepOutput(task.staff_task_steps.find((s) => s.version === task.version && s.phase === "eindvoorstel")?.output);
      return final ? [{ titel: task.title, goedgekeurd_op: task.decided_at?.slice(0, 10) ?? null, voorstel: final }] : [];
    }),
    goedgekeurde_stafvergaderingen: (meetings ?? []).flatMap((meeting) => {
      const overview = turnOutput(meeting.staff_meeting_turns.find((t) => t.version === meeting.version && t.kind === "overzicht")?.output)?.overzicht;
      return overview ? [{ opdracht: meeting.assignment, goedgekeurd_op: meeting.decided_at?.slice(0, 10) ?? null, overzicht: overview }] : [];
    }),
  };
}

/**
 * The competition as the staff may know it: positions, points and form of
 * the own team and the next opponent, without names of other teams.
 */
function competitionContext(
  own: string | null,
  matches: Tables<"competition_matches">[],
  standings: Tables<"competition_standings">[],
  today: string,
) {
  if (!own || (!matches.length && !standings.length)) return null;
  const letter = (o: "win" | "draw" | "loss") => messages.dashboard.form.letter[o];
  const row = standings.find((s) => s.team === own);
  const next = nextMatchOf(matches, own, today);
  const opponent = next ? opponentOf(next, own) : null;
  const opponentRow = opponent ? standings.find((s) => s.team === opponent && s.division === next!.division) : undefined;
  return {
    reeks: row?.division ?? next?.division ?? null,
    plaats: row?.position ?? null,
    punten: row?.points ?? null,
    gespeeld: row?.played ?? null,
    aantal_ploegen: row ? standings.filter((s) => s.division === row.division).length : null,
    vorm: formOf(matches, own).map(letter),
    volgende_wedstrijd: next
      ? {
          datum: next.match_date,
          aanvang: next.kickoff,
          thuis: next.home === own,
          tegenstander_plaats: opponentRow?.position ?? null,
          tegenstander_punten: opponentRow?.points ?? null,
          tegenstander_vorm: formOf(matches, opponent!).map(letter),
        }
      : null,
  };
}
