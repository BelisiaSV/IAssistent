import { weekPeriodization } from "@iassistent/staff-engine/content";

import { themeForTeam } from "@/lib/animation/team-theme";
import { messages } from "@/lib/messages";
import { formationCatalog, periodizationCatalog } from "@/lib/staff";
import { teamFormation } from "@/lib/teams/formation";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, mondayOf, shortDate, todayInBelgium } from "@/lib/weeks/dates";
import { seasonPlan } from "@/lib/weeks/season";
import { trainingScheduleSchema } from "@/lib/weeks/validation";

import { ScheduleForm } from "./schedule-form";
import { DisplayForm } from "./display-form";
import { SeasonForm } from "./season-form";
import { VenueForm } from "./venue-form";

const m = messages.settings;
const PREVIEW_WEEKS = 16;

export default async function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const schedule = trainingScheduleSchema.safeParse(team.training_schedule);
  const season = seasonPlan(team);

  // Planning preview: from the start of the preparation when it is still to come, else from this week.
  const thisWeek = mondayOf(todayInBelgium());
  const from = season.preparationStart && mondayOf(season.preparationStart) > thisWeek ? mondayOf(season.preparationStart) : thisWeek;
  const preview = Array.from({ length: PREVIEW_WEEKS }, (_, i) => {
    const week = addDays(from, i * 7);
    return { week, p: weekPeriodization(week, season, periodizationCatalog) };
  });
  const hasSeason = !!(season.preparationStart || season.competitionStart);
  const display = themeForTeam(team.animation_settings);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">{m.intro(team.name)}</p>
      <VenueForm
        teamId={team.id}
        initial={{ homeAddress: team.home_address ?? "", formation: teamFormation(team.default_formation).code }}
        formations={formationCatalog.formaties.map((f) => ({ code: f.code, naam: f.naam }))}
        canEdit={canEdit}
      />
      <ScheduleForm teamId={team.id} initial={schedule.success ? schedule.data : []} canEdit={canEdit} />
      <SeasonForm
        teamId={team.id}
        initial={season}
        cycles={periodizationCatalog.cycli.map((c) => c.weken)}
        canEdit={canEdit}
      />

      <div id="weergave" className="scroll-mt-6">
      <DisplayForm
        teamId={team.id}
        initial={{ stijl: display.settings.stijl, logo_op_schijfjes: display.settings.logo_op_schijfjes }}
        theme={display.theme}
        hasLogo={!!team.logo_path}
        canEdit={canEdit}
      />
      </div>

      <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">{m.preview.title}</h2>
        {!hasSeason ? (
          <p className="text-sm text-slate-600">{m.preview.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">{m.preview.week}</th>
                  <th className="py-1 pr-3 font-medium">{m.preview.phase}</th>
                  <th className="py-1 pr-3 font-medium">{m.preview.type}</th>
                  <th className="py-1 font-medium">{m.preview.load}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map(({ week, p }) => (
                  <tr key={week} className={week === thisWeek ? "bg-brand/5" : ""}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {shortDate(week)} – {shortDate(addDays(week, 6))}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {p.fase ? `${m.preview.phases[p.fase]}${p.week_van_fase ? ` ${m.preview.weekOf(p.week_van_fase)}` : ""}` : "–"}
                    </td>
                    <td className="py-1.5 pr-3">
                      {p.weektype ? p.weektype.naam : "–"}
                      {p.cyclus_weken && p.week_in_cyclus && (
                        <span className="ml-1 text-xs text-slate-500">({messages.weeks.periodization.week(p.week_in_cyclus, p.cyclus_weken)})</span>
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-slate-600">
                      {p.weektype?.belasting_pct ? messages.weeks.periodization.load(p.weektype.belasting_pct.min, p.weektype.belasting_pct.max) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
