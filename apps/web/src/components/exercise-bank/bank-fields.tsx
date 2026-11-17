import { messages } from "@/lib/messages";

const fields = messages.exerciseBank.fields;

function FieldValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-5">
        {value.map((item, i) => (
          <li key={i}>{typeof item === "object" && item ? String((item as { tekst?: unknown }).tekst ?? "") : String(item)}</li>
        ))}
      </ul>
    );
  }
  return <span>{String(value)}</span>;
}

/** The fields of a bank exercise that have a value, in a fixed order. */
export function BankFields({ content, omit = [] }: { content: unknown; omit?: string[] }) {
  const c = (content && typeof content === "object" ? content : {}) as Record<string, unknown>;
  const keys = Object.keys(fields).filter((key) => {
    if (omit.includes(key)) return false;
    const v = c[key];
    return Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "";
  });
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {keys.map((key) => (
        <div key={key}>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{fields[key]}</dt>
          <dd className="mt-0.5 text-slate-800">
            <FieldValue value={c[key]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
