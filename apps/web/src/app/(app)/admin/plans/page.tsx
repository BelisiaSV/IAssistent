import { notFound } from "next/navigation";

import { Modal } from "@/components/admin/modal";
import { AdminHeader, Badge, Row, Rows } from "@/components/admin/rows";
import { PlanCard } from "@/components/plans/plan-card";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { formatPrice } from "@/lib/plans/plans";
import { createClient } from "@/lib/supabase/server";

import { deletePlan } from "./actions";
import { DeleteButton } from "./delete-button";
import { PlanForm } from "./plan-form";

const m = messages.plans;

/** Admin only: the price plans, one row each; view, edit and add in a window. */
export default async function AdminPlansPage() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order")
    .order("name");

  return (
    <div className="space-y-4">
      <AdminHeader
        title={m.adminTitle}
        intro={m.adminIntro}
        actions={
          <Modal label={m.newPlan} plus wide>
            <PlanForm plan={null} />
          </Modal>
        }
      />
      <Rows empty={m.noPlans}>
        {(plans ?? []).map((plan) => (
          <Row
            key={plan.id}
            muted={!plan.active}
            meta={
              <>
                <span>{m.audience[plan.audience] ?? plan.audience}</span>
                <span className="tabular-nums">
                  {plan.price_cents === null
                    ? m.priceOnRequest
                    : `${formatPrice(plan.price_cents)} ${plan.billing_period === "month" ? m.perMonth : m.perYear}`}
                </span>
                {plan.recommended && (
                  <Badge tone="brand">{m.recommended}</Badge>
                )}
                {!plan.active && <Badge>{m.inactive}</Badge>}
              </>
            }
            actions={
              <>
                <Modal label={m.view} title={plan.name}>
                  <PlanCard plan={plan} />
                </Modal>
                <Modal label={m.edit} title={plan.name} wide>
                  <PlanForm plan={plan} />
                </Modal>
                <form action={deletePlan}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <DeleteButton />
                </form>
              </>
            }
          >
            {plan.name}
          </Row>
        ))}
      </Rows>
    </div>
  );
}
