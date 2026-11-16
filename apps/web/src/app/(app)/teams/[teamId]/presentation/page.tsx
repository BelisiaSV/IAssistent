import Link from "next/link";

import { EmptyState } from "@/components/card";
import { LogoManager } from "@/components/presentation/logo-manager";
import { PresentationViewer } from "@/components/presentation/viewer";
import { documentFonts } from "@/lib/fonts";
import { messages } from "@/lib/messages";
import { loadPresentation } from "@/lib/presentation/load";
import { shortDate } from "@/lib/weeks/dates";

const m = messages.presentation;

/** Presentatie: the match presentation of the Video Analyst (template of the club). */
export default async function PresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ datum?: string }>;
}) {
  const [{ teamId }, { datum }] = await Promise.all([params, searchParams]);
  const data = await loadPresentation(teamId, datum);

  const logos = data.opponent
    ? [data.opponent, ...(data.stats?.last ?? []).map((r) => ({ name: r.opponent, logoUrl: r.logoUrl }))].filter(
        (t, i, all) => all.findIndex((x) => x.name.toLowerCase() === t.name.toLowerCase()) === i,
      )
    : [];

  return (
    <div className={`space-y-5 ${documentFonts}`}>
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.intro}</p>
      </div>
      {!data.match ? (
        <EmptyState text={m.noMatch} href={`/teams/${teamId}/weeks`} link={messages.nav.microcycle} />
      ) : (
        <>
          {data.matches.length > 1 && (
            <nav aria-label={m.match} className="flex flex-wrap gap-2 print:hidden">
              {data.matches.map((x) => (
                <Link
                  key={x.date}
                  href={`?datum=${x.date}`}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${x.date === data.match!.date ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
                >
                  {shortDate(x.date)} · {x.opponent}
                </Link>
              ))}
            </nav>
          )}
          <PresentationViewer data={data} fileName={`presentatie-${data.match.date}`} />
          <LogoManager teamId={teamId} teams={logos} shirt={data.opponent} canEdit={data.canEdit} />
        </>
      )}
    </div>
  );
}
