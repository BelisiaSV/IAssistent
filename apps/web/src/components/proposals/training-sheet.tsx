import type { ReactNode } from "react";

import type { WeekExercises } from "@/lib/exercises/week";
import { documentFonts } from "@/lib/fonts";
import { messages } from "@/lib/messages";
import { withShirtNames } from "@/lib/proposals/names";
import { readableOn, shade, withAlpha } from "@/lib/proposals/overview";
import type { Drawing, DrawingsOutput, LoadPlanDay, SetPiece, TacticalWeekOutput, WeekPlanningDay, WeekPlanningPart } from "@/lib/proposals/types";
import { isoWeek, longDate, weekdayName } from "@/lib/weeks/dates";

import { AnimatedDrawing } from "./animated-drawing";
import { DocIcon, type DocIconName } from "./doc-icons";
import { DrawingView } from "./drawing";
import { VideoStill } from "./video-still";
import { stripes } from "./week-poster";

const s = messages.sheet;
const o = messages.proposals.output;
const x = messages.exercises;
const display = "font-[family-name:var(--font-display)]";

/** Parts per page: a 2 × 2 grid on portrait A4. */
const PER_PAGE = 4;

/** Day load → filled bars out of 5 (same scale as the week overview). */
const LOAD_BARS: Record<WeekPlanningDay["belasting"], number> = { rust: 0, laag: 2, matig: 3, hoog: 4, "zeer hoog": 5 };
const INTENSITY_BARS: Record<WeekPlanningPart["intensiteit"], number> = { laag: 2, matig: 3, hoog: 4, maximaal: 5 };

export interface SheetTeam {
  clubName: string;
  teamName: string;
  primary: string;
  secondary: string;
  logoUrl: string | null;
}

type Item = { kind: "part"; part: WeekPlanningPart; index: number } | { kind: "set-piece"; setPiece: SetPiece };

/** Colour of a phase: warm-up in the second team colour, core in the first, cool-down neutral. */
function phaseColor(fase: WeekPlanningPart["fase"], team: SheetTeam) {
  return fase === "kern" ? team.primary : fase === "opwarming" ? shade(team.secondary, 0.15) : "#64748b";
}

/**
 * One training day on portrait A4 pages: a header with the day's theme and
 * load, a timeline of the session, then every part (and the set pieces trained
 * that day) in a 2 × 2 grid with visual, load, explanation, coaching points
 * and progression.
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
    ...day.onderdelen.map((part, index) => ({ kind: "part" as const, part, index })),
    ...setPieces.filter((sp) => trained.has(sp.titel)).map((setPiece) => ({ kind: "set-piece" as const, setPiece })),
  ];
  const pages = Array.from({ length: Math.max(1, Math.ceil(items.length / PER_PAGE)) }, (_, i) => items.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
  const onPrimary = readableOn(team.primary);

  return (
    <>
      {pages.map((pageItems, pageIndex) => (
        <section
          key={pageIndex}
          lang="nl"
          className={`${documentFonts} mx-auto flex w-full max-w-[210mm] flex-col gap-3 bg-white p-5 [font-family:var(--font-body)] shadow-sm ring-1 ring-slate-200 print:break-after-page print:p-[7mm] print:shadow-none print:ring-0 print:last:break-after-auto`}
        >
          <header className="flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4" style={{ ...stripes(team.primary), color: onPrimary }}>
            {team.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1 shadow" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold tracking-[0.25em] uppercase opacity-75">
                {s.kicker} · {team.clubName} · {team.teamName}
              </p>
              <h1 className={`${display} text-[30px] leading-none font-extrabold uppercase`}>{weekdayName(day.datum)}</h1>
              <p className="text-xs opacity-85">
                {longDate(day.datum)} · {messages.poster.weekNumber(isoWeek(day.datum))}
              </p>
            </div>
            <div className="flex gap-2">
              <Chip icon="clock" label={s.start} value={day.tijdstip ?? "–"} />
              <Chip icon="timer" label={s.duration} value={day.totale_duur_min ? o.duration(day.totale_duur_min) : "–"} />
              <Chip icon="gauge" label={s.load} value={day.md ?? day.belasting}>
                <Bars value={LOAD_BARS[day.belasting]} color={onPrimary} track="rgba(255,255,255,0.25)" />
              </Chip>
            </div>
          </header>

          {pageIndex === 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Tile icon="target" title={s.theme} color={team.primary}>
                  {accent ? n(accent.thema) : n(day.titel)}
                </Tile>
                <Tile icon="flag" title={s.goal} color={team.primary}>
                  {n(accent?.doel ?? day.doel)}
                </Tile>
                <Tile icon="bolt" title={s.physical} color={team.primary}>
                  {load
                    ? [load.rpe_doel ? messages.loadPlan.rpeTarget(load.rpe_doel) : null, load.au_doel ? messages.loadPlan.au(load.au_doel) : null, load.accenten.join(", ") || null]
                        .filter(Boolean)
                        .join(" · ")
                    : day.belasting}
                </Tile>
              </div>
              <Timeline parts={day.onderdelen} team={team} n={n} />
            </>
          )}

          <div className="grid flex-1 grid-cols-2 gap-3">
            {pageItems.map((item, i) =>
              item.kind === "part" ? (
                <PartCard key={i} part={item.part} number={item.index + 1} datum={day.datum} drawings={drawings} library={library} n={n} team={team} />
              ) : (
                <SetPieceSheetCard key={i} setPiece={item.setPiece} library={library} n={n} team={team} />
              ),
            )}
          </div>

          <footer className="flex justify-between border-t border-slate-100 pt-2 text-[9px] font-medium tracking-wider text-slate-400 uppercase">
            <span>
              {team.clubName} · {team.teamName}
            </span>
            <span>{s.page(pageIndex + 1, pages.length)}</span>
          </footer>
        </section>
      ))}
    </>
  );
}

function Chip({ icon, label, value, children }: { icon: DocIconName; label: string; value: string; children?: ReactNode }) {
  return (
    <div className="min-w-[78px] rounded-xl border border-white/25 bg-white/10 px-3 py-1.5">
      <p className="flex items-center gap-1 text-[8px] font-bold tracking-[0.15em] uppercase opacity-75">
        <DocIcon name={icon} className="h-3 w-3" />
        {label}
      </p>
      <p className={`${display} text-[20px] leading-tight font-bold capitalize`}>{value}</p>
      {children}
    </div>
  );
}

function Tile({ icon, title, color, children }: { icon: DocIconName; title: string; color: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/70">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: withAlpha(color, 0.12), color }}>
        <DocIcon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[8.5px] font-bold tracking-[0.15em] text-slate-400 uppercase">{title}</p>
        <p className="text-[11px] leading-snug font-medium">{children}</p>
      </div>
    </div>
  );
}

/** The session as a bar: every part as a block as long as its duration. */
function Timeline({ parts, team, n }: { parts: WeekPlanningPart[]; team: SheetTeam; n: (text: string) => string }) {
  const total = parts.reduce((sum, p) => sum + p.duur_min, 0);
  if (!total) return null;
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((sum, p) => sum + p.duur_min, 0));
  return (
    <div className="flex gap-1">
      {parts.map((p, i) => {
        const start = starts[i]!;
        const end = start + p.duur_min;
        const color = phaseColor(p.fase, team);
        return (
          <div key={i} className="min-w-0 overflow-hidden rounded-lg px-2 py-1" style={{ flexGrow: p.duur_min, flexBasis: 0, backgroundColor: color, color: readableOn(color) }}>
            <p className="truncate text-[9.5px] font-semibold">
              {i + 1}. {n(p.naam)}
            </p>
            <p className="text-[8.5px] tabular-nums opacity-80">
              {start}′–{end}′
            </p>
          </div>
        );
      })}
    </div>
  );
}

function PartCard({
  part,
  number,
  datum,
  drawings,
  library,
  n,
  team,
}: {
  part: WeekPlanningPart;
  number: number;
  datum: string;
  drawings: DrawingsOutput | null;
  library: WeekExercises;
  n: (text: string) => string;
  team: SheetTeam;
}) {
  const own = part.oefening_id ? library.items.get(part.oefening_id) : undefined;
  const drawing =
    part.oefening_id || part.standaardsituaties?.length ? undefined : drawings?.oefeningen.find((d) => d.datum === datum && d.onderdeel === part.naam);
  const course = own?.course ?? drawing?.verloop ?? [];
  const variations = own?.variations ?? drawing?.variaties ?? [];
  const space = n(drawing?.organisatie ?? part.organisatie);
  const color = phaseColor(part.fase, team);
  const stats: [string, string][] = [
    [s.sets, part.reeksen ? `${part.reeksen}×` : "–"],
    [s.work, part.werk_per_reeks ?? o.duration(part.duur_min)],
    [s.rest, part.rust_tussen_reeksen ?? "–"],
    [s.rpe, part.rpe ? String(part.rpe) : "–"],
  ];

  return (
    <Card number={number} phase={o.phase[part.fase]} title={n(part.naam)} minutes={part.duur_min} badge={part.oefening_id ? x.fromLibrary : null} color={color}>
      {part.standaardsituaties?.length ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
          <SectionList icon="flag" title={s.setPieces} items={part.standaardsituaties} color={color} />
        </div>
      ) : (
        <Visual animation={own?.animation ?? null} videoUrl={own?.videoUrl ?? null} drawing={drawing?.tekening ?? null} library={library} />
      )}
      <div className="grid grid-cols-4 gap-1">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-md bg-slate-50 px-1.5 py-1 text-center ring-1 ring-slate-200/70">
            <p className="text-[7.5px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
            <p className={`${display} truncate text-[14px] leading-tight font-bold`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-[9.5px] text-slate-600">
        <span className="flex min-w-0 items-center gap-1">
          <DocIcon name="users" className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate">{part.spelers}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 capitalize">
          {part.intensiteit}
          <Bars value={INTENSITY_BARS[part.intensiteit]} color={color} track="#e2e8f0" small />
        </span>
      </div>
      {space && (
        <p className="flex gap-1 text-[9.5px] leading-tight text-slate-600">
          <DocIcon name="ruler" className="mt-px h-3 w-3 shrink-0 text-slate-400" />
          {space}
        </p>
      )}
      <SectionList icon="list" title={s.explanation} items={course.map(n)} color={color} ordered />
      <SectionList icon="check" title={s.coaching} items={part.coachingspunten.map(n)} color={color} />
      <SectionList icon="arrow" title={s.progression} items={variations.map(n)} color={color} />
    </Card>
  );
}

function SetPieceSheetCard({ setPiece, library, n, team }: { setPiece: SetPiece; library: WeekExercises; n: (text: string) => string; team: SheetTeam }) {
  const own = setPiece.standaardsituatie_id ? library.items.get(setPiece.standaardsituatie_id) : undefined;
  const color = shade(team.secondary, 0.15);
  return (
    <Card
      number={null}
      phase={messages.matchPlan.setPieceKind[setPiece.soort]}
      title={setPiece.titel}
      minutes={null}
      badge={setPiece.standaardsituatie_id ? x.fromLibrary : null}
      color={color}
    >
      <Visual animation={own?.animation ?? null} videoUrl={own?.videoUrl ?? null} drawing={setPiece.tekening} library={library} />
      {own?.signal && (
        <p className="rounded-md px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: withAlpha(color, 0.15) }}>
          {s.signal}: {own.signal}
        </p>
      )}
      <SectionList icon="list" title={s.agreements} items={setPiece.afspraken.map(n)} color={color} />
      <SectionList icon="users" title={s.tasks} items={setPiece.taken.map((t) => n(`#${t.rugnummer}: ${t.taak}`))} color={color} />
    </Card>
  );
}

function Card({
  number,
  phase,
  title,
  minutes,
  badge,
  color,
  children,
}: {
  number: number | null;
  phase: string;
  title: string;
  minutes: number | null;
  badge: string | null;
  color: string;
  children: ReactNode;
}) {
  return (
    <article className="flex break-inside-avoid flex-col gap-1.5 overflow-hidden rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
      <header className="flex items-start gap-2">
        <span
          className={`${display} flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[15px] font-bold`}
          style={{ backgroundColor: color, color: readableOn(color) }}
        >
          {number ?? <DocIcon name="flag" className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[8.5px] font-bold tracking-[0.15em] uppercase" style={{ color }}>
            {phase}
            {badge && <span className="rounded-full bg-slate-100 px-1.5 py-px font-semibold tracking-normal text-slate-500 normal-case">{badge}</span>}
          </p>
          <h2 className={`${display} truncate text-[17px] leading-tight font-bold`}>{title}</h2>
        </div>
        {minutes !== null && (
          <span className={`${display} shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[13px] font-bold text-slate-700 tabular-nums`}>{o.duration(minutes)}</span>
        )}
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
  // Every visual gets the same frame, whatever the shape of the field.
  return (
    <div className="flex h-[112px] items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200/70 [&_img]:h-[112px] [&_img]:w-auto [&_img]:object-contain [&_svg]:mx-auto [&_svg]:h-[108px]! [&_svg]:max-h-none! [&_svg]:w-auto! [&_svg~*]:hidden [&_video]:h-[112px] [&>*]:w-full">
      {animation ? (
        <AnimatedDrawing animation={animation} theme={library.display.theme} logoUrl={library.logoUrl} logoOn={library.display.logoOn} labels={x.player} />
      ) : videoUrl ? (
        <VideoStill src={videoUrl} />
      ) : drawing ? (
        <DrawingView drawing={drawing} />
      ) : (
        <DocIcon name="ball" className="h-10 w-10 text-slate-300" />
      )}
    </div>
  );
}

function SectionList({ icon, title, items, color, ordered = false }: { icon: DocIconName; title: string; items: string[]; color: string; ordered?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="text-[9.5px] leading-snug">
      <p className="mb-0.5 flex items-center gap-1 text-[8.5px] font-bold tracking-[0.15em] text-slate-400 uppercase">
        <DocIcon name={icon} className="h-3 w-3" />
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span>
              {ordered && <span className="font-semibold">{i + 1}. </span>}
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ value, color, track, small = false }: { value: number; color: string; track: string; small?: boolean }) {
  return (
    <span className={`mt-1 flex gap-0.5 ${small ? "mt-0 w-10" : "w-full"}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`flex-1 rounded-full ${small ? "h-1" : "h-1.5"}`} style={{ backgroundColor: i < value ? color : track }} />
      ))}
    </span>
  );
}
