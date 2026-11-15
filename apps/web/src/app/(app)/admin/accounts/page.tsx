import { notFound } from "next/navigation";

import { Button } from "@/components/ui";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { setAccountPlan } from "../plans/actions";

const m = messages.plans.accounts;

/** Admin only: every account with its plan; assign a plan to see what the customer sees. */
export default async function AdminAccountsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const [{ data: accounts }, { data: plans }] = await Promise.all([
    supabase.rpc("admin_accounts"),
    supabase.from("plans").select("id, name, active").order("sort_order").order("name"),
  ]);

  return (
    <div className="space-y-5">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{m.email}</th>
              <th className="px-4 py-3 font-medium">{m.name}</th>
              <th className="px-4 py-3 font-medium">{m.plan}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(accounts ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5">
                  {a.email}
                  {a.id === user.id && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">{m.you}</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{a.full_name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <form action={setAccountPlan} className="flex items-center gap-2">
                    <input type="hidden" name="coachId" value={a.id} />
                    <select name="planId" defaultValue={a.plan_id ?? ""} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                      <option value="">{m.none}</option>
                      {(plans ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.active ? "" : ` (${messages.plans.inactive.toLowerCase()})`}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary" className="px-3 py-1.5">
                      {m.save}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
