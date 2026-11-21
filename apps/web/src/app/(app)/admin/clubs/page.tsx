import Link from "next/link";
import { notFound } from "next/navigation";

import { Modal } from "@/components/admin/modal";
import {
  AdminHeader,
  Badge,
  Row,
  rowButton,
  Rows,
} from "@/components/admin/rows";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { longDate } from "@/lib/weeks/dates";

import { NewClubForm } from "./new-club-form";

const m = messages.clubAdmin;

/** Admin only: the clubs of the platform, one row each; + makes a new club from the federation export. */
export default async function AdminClubsPage() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const [{ data: clubs }, { data: federation }] = await Promise.all([
    supabase.rpc("admin_clubs"),
    supabase.rpc("admin_federation_clubs"),
  ]);
  const options = (federation ?? []).map((f) => ({
    number: f.number,
    name: f.name,
    teams: Array.isArray(f.teams) ? f.teams.length : 0,
    made: f.club_id !== null,
  }));

  return (
    <div className="space-y-4">
      <AdminHeader
        title={m.title}
        intro={m.intro}
        actions={
          <Modal label={m.newClub.title} plus>
            <p className="mb-4 text-sm text-slate-600">{m.newClub.intro}</p>
            <NewClubForm options={options} />
          </Modal>
        }
      />
      <Rows empty={m.empty}>
        {(clubs ?? []).map((club) => (
          <Row
            key={club.id}
            meta={
              <>
                <span>{club.federation_number ?? "—"}</span>
                <span>{club.plan_name ?? m.noPlan}</span>
                <span className="tabular-nums" title={m.columns.licenses}>
                  {m.columns.licenses}: {club.seats_used}/{club.license_seats}
                </span>
                <span className="tabular-nums" title={m.columns.teams}>
                  {m.columns.teams}: {club.active_teams}/
                  {club.max_teams ?? m.unlimited}
                </span>
                <span className="tabular-nums">
                  {m.columns.members}: {club.members}
                </span>
                <Badge tone={club.active ? "green" : "slate"}>
                  {club.active ? m.active : m.inactive}
                </Badge>
                {club.active && club.ends_on && (
                  <span>{m.until(longDate(club.ends_on))}</span>
                )}
              </>
            }
            actions={
              <Link
                href={`/admin/clubs/${club.id}`}
                className={rowButton(true)}
              >
                {m.open}
              </Link>
            }
          >
            <Link href={`/admin/clubs/${club.id}`} className="hover:underline">
              {club.name}
            </Link>
          </Row>
        ))}
      </Rows>
    </div>
  );
}
