import { notFound } from "next/navigation";

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

import { setAccountPlan } from "../plans/actions";

const m = messages.plans.accounts;

/** Admin only: every account on one row with its plan; assign a plan to see what the customer sees. */
export default async function AdminAccountsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const [{ data: accounts }, { data: plans }] = await Promise.all([
    supabase.rpc("admin_accounts"),
    supabase
      .from("plans")
      .select("id, name, active")
      .order("sort_order")
      .order("name"),
  ]);

  return (
    <div className="space-y-4">
      <AdminHeader title={m.title} intro={m.intro} />
      <Rows>
        {(accounts ?? []).map((a) => (
          <Row
            key={a.id}
            meta={<span>{a.full_name ?? "—"}</span>}
            actions={
              <form
                action={setAccountPlan}
                className="flex items-center gap-1.5"
              >
                <input type="hidden" name="coachId" value={a.id} />
                <select
                  name="planId"
                  defaultValue={a.plan_id ?? ""}
                  aria-label={m.plan}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="">{m.none}</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.active
                        ? ""
                        : ` (${messages.plans.inactive.toLowerCase()})`}
                    </option>
                  ))}
                </select>
                <button type="submit" className={rowButton()}>
                  {m.save}
                </button>
              </form>
            }
          >
            {a.email}
            {a.id === user.id && (
              <span className="ml-2">
                <Badge tone="brand">{m.you}</Badge>
              </span>
            )}
          </Row>
        ))}
      </Rows>
    </div>
  );
}
