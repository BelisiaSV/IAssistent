import { notFound } from "next/navigation";

import { PlanCard } from "@/components/plans/plan-card";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { deletePlan } from "./actions";
import { DeleteButton } from "./delete-button";
import { PlanForm } from "./plan-form";

const m = messages.plans;

/** Admin only: the price plans, as the customer sees them, each with its edit form. */
export default async function AdminPlansPage() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const { data: plans } = await supabase.from("plans").select("*").order("sort_order").order("name");

  return (
    <div className="space-y-5">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.adminTitle}</h1>
        <p className="text-sm text-slate-600">{m.adminIntro}</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(plans ?? []).map((plan) => (
          <li key={plan.id}>
            <PlanCard
              plan={plan}
              footer={
                <details className="group rounded-xl bg-slate-50 ring-1 ring-slate-200">
                  <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold text-slate-700">{m.edit}</summary>
                  <div className="space-y-4 border-t border-slate-200 p-4">
                    <PlanForm plan={plan} />
                    <form action={deletePlan} className="text-right">
                      <input type="hidden" name="planId" value={plan.id} />
                      <DeleteButton />
                    </form>
                  </div>
                </details>
              }
            />
          </li>
        ))}
      </ul>

      <details className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-800">+ {m.newPlan}</summary>
        <div className="border-t border-slate-200 p-5">
          <PlanForm plan={null} />
        </div>
      </details>
    </div>
  );
}
