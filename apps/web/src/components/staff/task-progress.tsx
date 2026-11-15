import { messages } from "@/lib/messages";

const m = messages.staffRoom;

/** The steps of a task; `step` is the one it is at. */
export function TaskProgress({ step }: { step: number }) {
  return (
    <ol aria-label={m.progress} className="flex items-center gap-1.5 px-1">
      {m.steps.map((label, i) => (
        <li key={label} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={`h-1 rounded-full ${i <= step ? "bg-brand" : "bg-slate-200"}`} />
          <span className={`truncate text-[10px] ${i === step ? "font-semibold text-slate-700" : "text-slate-400"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}
