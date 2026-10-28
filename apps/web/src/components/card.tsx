import Link from "next/link";
import type { ReactNode } from "react";

import { readableOn } from "@/lib/proposals/overview";

/** The white card of the platform (dashboard style). */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</section>;
}

/** Small uppercase title of a card, with an optional hint and action on the right. */
export function CardHeader({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div>
        <h2 className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Dashed box for "nothing here yet", optionally with a link to fix it. */
export function EmptyState({ text, href, link }: { text: string; href?: string; link?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
      <p>{text}</p>
      {href && link && (
        <Link href={href} className="mt-2 inline-block font-medium text-brand hover:text-brand-dark">
          {link} →
        </Link>
      )}
    </div>
  );
}

/** A link as a button: in the team colour, or outlined (subtle). */
export function ButtonLink({ href, children, color, subtle = false }: { href: string; children: ReactNode; color?: string; subtle?: boolean }) {
  if (subtle || !color) {
    return (
      <Link href={href} className="inline-flex items-center rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
        {children}
      </Link>
    );
  }
  return (
    <Link href={href} className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm hover:opacity-90" style={{ backgroundColor: color, color: readableOn(color) }}>
      {children}
    </Link>
  );
}

/** A number with a label, optionally with a coloured dot (status) or in the team colour. */
export function StatTile({ label, value, sub, dot, ink }: { label: string; value: ReactNode; sub?: string; dot?: string; ink?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2" style={ink ? { backgroundColor: `color-mix(in srgb, ${ink} 8%, white)` } : undefined}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </p>
      <p className="text-xl font-extrabold text-slate-900 tabular-nums" style={ink ? { color: ink } : undefined}>
        {value}
        {sub && <span className="ml-1 text-xs font-medium text-slate-400">{sub}</span>}
      </p>
    </div>
  );
}
