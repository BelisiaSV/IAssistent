import { PlanCard } from "@/components/plans/plan-card";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const m = messages.plans.account;

/** Mijn abonnement: the plan of the account and every active plan, as a customer sees them. */
export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: coach }, { data: plans }] = await Promise.all([
    supabase.from("coaches").select("plan_id").eq("id", user.id).maybeSingle(),
    supabase.from("plans").select("*").eq("active", true).order("sort_order").order("name"),
  ]);
  const current = (plans ?? []).find((p) => p.id === coach?.plan_id) ?? null;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <h2 className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">{m.current}</h2>
        {current ? (
          <div className="max-w-md">
            <PlanCard plan={current} current />
          </div>
        ) : (
          <p className="max-w-xl rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">{m.noPlan}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">{m.all}</h2>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} current={plan.id === current?.id} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
