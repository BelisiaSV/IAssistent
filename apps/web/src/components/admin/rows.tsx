import type { ReactNode } from "react";

/** A small button or link on a row. */
export function rowButton(primary = false): string {
  return `inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
    primary
      ? "bg-brand text-white hover:bg-brand-dark"
      : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
  }`;
}

/** Title of an admin page on one line, with an optional + or other actions on the right. */
export function AdminHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  /** Short help, shown small under the title. */
  intro?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {intro && <p className="max-w-4xl text-xs text-slate-500">{intro}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** A list of one-line rows. */
export function Rows({
  title,
  children,
  empty,
}: {
  title?: ReactNode;
  children: ReactNode;
  empty?: string;
}) {
  const hasRows = Array.isArray(children) ? children.some(Boolean) : !!children;
  return (
    <section className="space-y-1.5">
      {title && (
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      )}
      {hasRows ? (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
          {children}
        </ul>
      ) : (
        empty && (
          <p className="rounded-xl bg-white px-3 py-2.5 text-sm text-slate-500 ring-1 ring-slate-200">
            {empty}
          </p>
        )
      )}
    </section>
  );
}

/** One row: the main text on the left, details and actions to the right, on one line where it fits. */
export function Row({
  children,
  meta,
  actions,
  muted = false,
}: {
  children: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  muted?: boolean;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm ${muted ? "text-slate-400" : ""}`}
    >
      <div className="min-w-0 flex-1 font-medium">{children}</div>
      {meta && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {meta}
        </div>
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
      )}
    </li>
  );
}

/** A small label (status, count). */
export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "sky" | "brand";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    sky: "bg-sky-100 text-sky-800",
    brand: "bg-brand/15 text-brand",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
