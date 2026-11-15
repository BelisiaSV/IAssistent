import { FEATURE_FLAGS, type FeatureFlagKey } from "@iassistent/db";

import { type StaffRoleCard, StaffHierarchy } from "@/components/staff/staff-hierarchy";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { NAV_GROUPS } from "@/lib/navigation";
import { staff } from "@/lib/staff";
import { getTeamContext } from "@/lib/teams/queries";

/** Flag that switches a role on; roles without one (not built yet) are "soon". */
const ROLE_FLAGS: Record<string, FeatureFlagKey> = {
  "assistant-coach": FEATURE_FLAGS.assistantCoach,
  "physical-coach": FEATURE_FLAGS.physicalCoach,
  "tactical-coach": FEATURE_FLAGS.tacticalCoach,
};

/** Mijn staf: the hierarchy of the AI staff, from the head coach to approval and publication. */
export default async function StaffPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
  const roles: StaffRoleCard[] = await Promise.all(
    NAV_GROUPS.filter((g) => g.member !== "head-coach").map(async (group) => {
      const role = staff.roles.find((r) => r.id === group.member);
      const flag = ROLE_FLAGS[group.member];
      const status = !role || role.meta.status === "placeholder" || !flag ? "soon" : (await isFeatureEnabled(flag)) ? "active" : "off";
      return { group, name: role?.meta.naam ?? group.member, status };
    }),
  );
  return <StaffHierarchy teamId={team.id} roles={roles} />;
}
