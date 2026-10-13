import { messages } from "@/lib/messages";

import { TeamForm } from "./team-form";

export default function NewTeamPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{messages.teamForm.title}</h1>
        <p className="text-sm text-slate-600">{messages.teamForm.intro}</p>
      </div>
      <TeamForm />
    </div>
  );
}
