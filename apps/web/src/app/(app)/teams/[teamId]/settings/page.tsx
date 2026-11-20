import Link from "next/link";

import { themeForTeam } from "@/lib/animation/team-theme";
import { messages } from "@/lib/messages";
import { cardRules } from "@/lib/players/cards";
import { formationCatalog } from "@/lib/staff";
import { ageCategory } from "@/lib/teams/age-categories";
import { teamFormation } from "@/lib/teams/formation";
import { getTeamContext } from "@/lib/teams/queries";
import { trainingScheduleSchema } from "@/lib/weeks/validation";

import { CardRulesForm } from "./card-rules-form";
import { ClubLink } from "./club-link";
import { ScheduleForm } from "./schedule-form";
import { DisplayForm } from "./display-form";
import { VenueForm } from "./venue-form";

const m = messages.settings;

export default async function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const schedule = trainingScheduleSchema.safeParse(team.training_schedule);
  const display = themeForTeam(team.animation_settings);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">{m.intro(team.name)}</p>
      <VenueForm
        teamId={team.id}
        initial={{ homeAddress: team.home_address ?? "", formation: teamFormation(team.default_formation).code, ageCategory: ageCategory(team.age_category) }}
        formations={formationCatalog.formaties.map((f) => ({ code: f.code, naam: f.naam }))}
        canEdit={canEdit}
      />
      <CardRulesForm teamId={team.id} initial={cardRules(team)} canEdit={canEdit} />
      <ScheduleForm teamId={team.id} initial={schedule.success ? schedule.data : []} canEdit={canEdit} />
      <p className="text-sm text-slate-600">
        {m.seasonMoved}{" "}
        <Link href={`/teams/${team.id}/periodization`} className="font-medium text-brand hover:underline">
          {messages.nav.periodization} →
        </Link>
      </p>

      <div id="weergave" className="scroll-mt-6">
      <DisplayForm
        teamId={team.id}
        initial={{ stijl: display.settings.stijl, logo_op_schijfjes: display.settings.logo_op_schijfjes }}
        theme={display.theme}
        hasLogo={!!team.logo_path}
        canEdit={canEdit}
      />
      </div>

      <ClubLink team={team} canEdit={canEdit} />
    </div>
  );
}
