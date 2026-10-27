import type { ReactNode } from "react";

import type { WeekExercises } from "@/lib/exercises/week";
import { messages } from "@/lib/messages";
import { withShirtNames } from "@/lib/proposals/names";
import { readableOn } from "@/lib/proposals/overview";
import type { Drawing, DrawingsOutput, LoadPlanDay, SetPiece, TacticalWeekOutput, WeekPlanningDay, WeekPlanningPart } from "@/lib/proposals/types";
import { shortDate, weekdayName } from "@/lib/weeks/dates";

import { AnimatedDrawing } from "./animated-drawing";
import { DrawingView } from "./drawing";
import { VideoStill } from "./video-still";

const s = messages.sheet;
const o = messages.proposals.output;
const x = messages.exercises;

/** Parts per page: a 2 × 2 grid on portrait A4. */
const PER_PAGE = 4;

export interface SheetTeam {
  clubName: string;
  teamName: string;
  primary: string;
  logoUrl: string | null;
}

type Item = { kind: "part"; part: WeekPlanningPart } | { kind: "set-piece"; setPiece: SetPiece };

/**
 * One training day on portrait A4 pages: a header with the day's theme and
 * load, then every part (and the set pieces trained that day) in a 2 × 2 grid
 * with its visual, load, explanation, coaching points and progression.
 */
export function TrainingSheet({
  day,
  accent,
  load,
  drawings,
  setPieces,
  library,
  names,
  team,
}: {
  day: WeekPlanningDay;
  accent: TacticalWeekOutput["trainingsaccenten"][number] | null;
  load: LoadPlanDay | null;
  drawings: DrawingsOutput | null;
  setPieces: SetPiece[];
  library: WeekExercises;
  names: Map<number, string>;
  team: SheetTeam;
}) {
  const n = (text: string) => withShirtNames(text, names);
  const trained = new Set(day.onderdelen.flatMap((p) => p.standaardsituaties ?? []));
  const items: Item[] = [
    ...day.onderdelen.map((part) => ({ kind: "part" as const, part })),
    ...setPieces.filter((sp) => trained.has(sp.titel)).map((setPiece) => ({ kind: "set-piece" as const, setPiece })),
  ];
  const pages = Array.from({ length: Math.max(1, Math.ceil(items.length / PER_PAGE)) }, (_, i) => items.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
  const onPrimary = readableOn(team.primary);
  const title = s.title(weekdayName(day.datum), shortDate(day.datum));

  return (
    <>
      {pages.map((pageItems, pageIndex) => (
        <section
          key={pageIndex}
          className="mx-auto flex w-full max-w-[210mm] flex-col gap-3 bg-white p-5 shadow-sm ring-1 ring-slate-200 print:break-after-page print:p-[8mm] print:last:break-after-auto print:shadow-none print:ring-0"
        >
          <header className="flex items-center gap-4 rounded-xl px-4 py-3" style={{ backgroundColor: team.primary, color: onPrimary }}>
            {team.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logoUrl} alt="" className="h-12 w-12 rounded-full bg-white object-contain p-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase opacity-80">
                {team.clubName} · {team.teamName}
              </p>
              <h1 className="text-xl font-extrabold first-letter:uppercase">{title}</h1>
            </div>
            <dl className="grid grid-cols-3 gap-x-4 text-right text-xs">
              <Meta label={s.start} value={day.tijdstip} />
              <Meta label={s.duration} value={day.totale_duur_min ? o.duration(day.totale_duur_min) : null} />
              <Meta label={s.load} value={day.md ? `${day.belasting} · ${day.md}` : day.belasting} />
            </dl>
          </header>

          {pageIndex === 0 && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Box title={s.theme}>{accent ? n(accent.thema) : n(day.titel)}</Box>
              <Box title={s.goal}>{n(accent?.doel ?? day.doel)}</Box>
              <Box title={s.physical}>
                {load
                  ? [
                      load.rpe_doel ? messages.loadPlan.rpeTarget(load.rpe_doel) : null,
                      load.au_doel ? messages.loadPlan.au(load.au_doel) : null,
                      load.accenten.join(", ") || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : day.belasting}
              </Box>
            </div>
          )}

          <div className="grid flex-1 grid-cols-2 gap-3">
            {pageItems.map((item, i) =>
              item.kind === "part" ? (
                <PartCard key={i} part={item.part} datum={day.datum} drawings={drawings} library={library} n={n} color={team.primary} />
              ) : (
                <SetPieceSheetCard key={i} setPiece={item.setPiece} library={library} n={n} color={team.primary} />
              ),
            )}
          </div>
        </section>
      ))}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wider uppercase opacity-75">{label}</dt>
      <dd className="font-semibold capitalize">{value ?? "–"}</dd>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{title}</p>
      <p className="leading-snug">{children}</p>
    </div>
  );
}

function PartCard({
  part,
  datum,
  drawings,
  library,
  n,
  color,
}: {
  part: WeekPlanningPart;
  datum: string;
  drawings: DrawingsOutput | null;
  library: WeekExercises;
  n: (text: string) => string;
  color: string;
}) {
  const own = part.oefening_id ? library.items.get(part.oefening_id) : undefined;
  const drawing =
    part.oefening_id || part.standaardsituaties?.length
      ? undefined
      : drawings?.oefeningen.find((d) => d.datum === datum && d.onderdeel === part.naam);
  const course = own?.course ?? drawing?.verloop ?? [];
  const variations = own?.variations ?? drawing?.variaties ?? [];
  const space = n(drawing?.organisatie ?? part.organisatie);
  const facts: [string, string | null][] = [
    [s.players, part.spelers],
    [s.duration, o.duration(part.duur_min)],
    [s.sets, part.reeksen ? String(part.reeksen) : null],
    [s.work, part.werk_per_reeks],
    [s.rest, part.rust_tussen_reeksen],
    [s.intensity, [part.intensiteit, part.rpe ? o.rpe(part.rpe) : null].filter(Boolean).join(" · ")],
  ];

  return (
    <Card phase={o.phase[part.fase]} title={n(part.naam)} badge={part.oefening_id ? x.fromLibrary : null} color={color}>
      {part.standaardsituaties?.length ? (
        <List title={s.setPieces} items={part.standaardsituaties} />
      ) : (
        <Visual animation={own?.animation ?? null} videoUrl={own?.videoUrl ?? null} drawing={drawing?.tekening ?? null} library={library} />
      )}
      <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-0.5 text-[10px] leading-tight">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-slate-500">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {space && (
        <p className="text-[10px] leading-tight">
          <span className="font-semibold text-slate-500">{s.space}:</span> {space}
        </p>
      )}
      <List title={s.explanation} items={course.map(n)} ordered />
      <List title={s.coaching} items={part.coachingspunten.map(n)} />
      <List title={s.progression} items={variations.map(n)} />
    </Card>
  );
}

function SetPieceSheetCard({ setPiece, library, n, color }: { setPiece: SetPiece; library: WeekExercises; n: (text: string) => string; color: string }) {
  const own = setPiece.standaardsituatie_id ? library.items.get(setPiece.standaardsituatie_id) : undefined;
  return (
    <Card
      phase={messages.matchPlan.setPieceKind[setPiece.soort]}
      title={setPiece.titel}
      badge={setPiece.standaardsituatie_id ? x.fromLibrary : null}
      color={color}
    >
      <Visual animation={own?.animation ?? null} videoUrl={own?.videoUrl ?? null} drawing={setPiece.tekening} library={library} />
      {own?.signal && (
        <p className="text-[10px]">
          <span className="font-semibold text-slate-500">{s.signal}:</span> {own.signal}
        </p>
      )}
      <List title={s.agreements} items={setPiece.afspraken.map(n)} />
      <List title={s.tasks} items={setPiece.taken.map((t) => n(`#${t.rugnummer}: ${t.taak}`))} />
    </Card>
  );
}

function Card({ phase, title, badge, color, children }: { phase: string; title: string; badge: string | null; color: string; children: ReactNode }) {
  return (
    <article className="flex break-inside-avoid flex-col gap-1.5 rounded-xl p-2.5 ring-1 ring-slate-200">
      <header className="border-l-4 pl-2" style={{ borderColor: color }}>
        <p className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          {phase}
          {badge && <span className="rounded-full bg-slate-100 px-1.5 py-px font-medium normal-case tracking-normal">{badge}</span>}
        </p>
        <h2 className="text-sm leading-tight font-bold">{title}</h2>
      </header>
      {children}
    </article>
  );
}

function Visual({
  animation,
  videoUrl,
  drawing,
  library,
}: {
  animation: NonNullable<ReturnType<WeekExercises["items"]["get"]>>["animation"];
  videoUrl: string | null;
  drawing: Drawing | null;
  library: WeekExercises;
}) {
  // Every visual gets the same height, whatever the shape of the field.
  return <div className="[&_svg]:mx-auto [&_svg]:max-h-[150px]! [&_svg]:w-auto! [&_svg~*]:hidden [&_video]:max-h-[150px] [&_img]:max-h-[150px] [&_img]:object-contain">{visual()}</div>;

  function visual() {
  if (animation) {
    return (
      <AnimatedDrawing
        animation={animation}
        theme={library.display.theme}
        logoUrl={library.logoUrl}
        logoOn={library.display.logoOn}
        labels={x.player}
      />
    );
  }
  if (videoUrl) return <VideoStill src={videoUrl} />;
  if (drawing) return <DrawingView drawing={drawing} />;
  return null;
  }
}

function List({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div className="text-[10px] leading-tight">
      <p className="font-semibold text-slate-500">{title}</p>
      <Tag className={`${ordered ? "list-decimal" : "list-disc"} space-y-px pl-4`}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>
    </div>
  );
}
