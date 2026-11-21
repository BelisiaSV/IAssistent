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

import { ImportForm } from "./import-form";

const m = messages.playerImport;

/** Admin only: import players from the Excel template into a team — one row per team. */
export default async function AdminPlayersPage() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const { data: teams } = await supabase.rpc("admin_teams");

  return (
    <div className="space-y-4">
      <AdminHeader
        title={m.title}
        intro={m.intro}
        actions={
          <a href="/admin/players/template" className={rowButton()}>
            {m.templateEmpty}
          </a>
        }
      />
      <Rows empty={m.noTeams}>
        {(teams ?? []).map((t) => (
          <Row
            key={t.id}
            muted={t.archived}
            meta={
              <>
                <span>{t.head_coach_email}</span>
                {t.archived && <Badge>{m.archived}</Badge>}
              </>
            }
            actions={
              !t.archived && (
                <>
                  <a
                    href={`/admin/players/template?team=${t.id}`}
                    className={rowButton()}
                  >
                    {m.templateFilled}
                  </a>
                  <Modal
                    label={m.importButton}
                    title={`${m.title} — ${t.club_name} ${t.name}`}
                    primary
                    wide
                  >
                    <ImportForm teamId={t.id} />
                  </Modal>
                </>
              )
            }
          >
            {t.club_name} – {t.name}
          </Row>
        ))}
      </Rows>
    </div>
  );
}
