"use client";

import { useMemo, useState, useTransition } from "react";

import { Alert, Button } from "@/components/ui";
import { federationClubs } from "@/lib/clubs/federation";
import {
  decodeExport,
  forDivisions,
  type ParsedExport,
  parseExport,
  teamDivisions,
} from "@/lib/competition/parse";
import { messages } from "@/lib/messages";

import { saveFederationClubs } from "../clubs/actions";
import { importCompetition, type ImportResult, linkTeam } from "./actions";

const m = messages.competition.admin;

type Team = {
  id: string;
  name: string;
  clubName: string;
  archived: boolean;
  federationTeam: string;
  divisions: string[];
};
type Exports = Partial<Record<ParsedExport["kind"], ParsedExport>>;

/**
 * The files are read in the browser (they hold every division of every club);
 * only the rows of the linked divisions go to the server.
 */
export function CompetitionImport({
  teams: initial,
  clubNumbers,
  clubDivisions,
}: {
  teams: Team[];
  /** Registration numbers of the clubs on the platform. */
  clubNumbers: string[];
  /** Divisions of their teams, as last saved. */
  clubDivisions: string[];
}) {
  const [teams, setTeams] = useState(initial);
  const [exports, setExports] = useState<Exports>({});
  const [unknown, setUnknown] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [clubCount, setClubCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(
    () => Object.values(exports).filter((e): e is ParsedExport => !!e),
    [exports],
  );
  const catalog = useMemo(() => teamDivisions(parsed), [parsed]);
  const names = useMemo(
    () => [...catalog.keys()].sort((a, b) => a.localeCompare(b, "nl")),
    [catalog],
  );
  const linked = useMemo(
    () => new Set(teams.filter((t) => !t.archived).flatMap((t) => t.divisions)),
    [teams],
  );
  // Divisions of every team of the clubs on the platform (from the files when there, else as saved).
  const clubs = useMemo(() => {
    const numbers = new Set(clubNumbers);
    const fresh =
      exports.results?.kind === "results"
        ? federationClubs(exports.results.rows)
            .filter((c) => numbers.has(c.number))
            .flatMap((c) => c.teams.flatMap((t) => t.divisions))
        : [];
    return new Set([...clubDivisions, ...fresh]);
  }, [clubNumbers, clubDivisions, exports]);
  const divisions = useMemo(
    () => new Set([...linked, ...clubs]),
    [linked, clubs],
  );

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    setResult(null);
    const next: Exports = { ...exports };
    const bad: string[] = [];
    for (const file of Array.from(files)) {
      const parsedFile = parseExport(decodeExport(await file.arrayBuffer()));
      if (parsedFile) next[parsedFile.kind] = parsedFile;
      else bad.push(file.name);
    }
    setExports(next);
    setUnknown(bad);
    // The clubs in the calendar go to the club list (Admin → Clubs).
    if (next.results?.kind === "results" && next.results !== exports.results) {
      const saved = await saveFederationClubs(
        federationClubs(next.results.rows),
      );
      setClubCount(saved.count ?? null);
    }
    setReading(false);
  }

  const payload = useMemo(
    () => ({
      divisions: [...divisions],
      matches:
        exports.results?.kind === "results"
          ? forDivisions(exports.results.rows, divisions)
          : [],
      standings:
        exports.standings?.kind === "standings"
          ? forDivisions(exports.standings.rows, divisions)
          : [],
      referees:
        exports.referees?.kind === "referees"
          ? forDivisions(exports.referees.rows, divisions)
          : [],
    }),
    [exports, divisions],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          {reading ? m.reading : m.files}
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            className="sr-only"
            onChange={(event) => readFiles(event.target.files)}
          />
        </label>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["results", "standings", "referees"] as const).map((kind) => (
            <li
              key={kind}
              className={`rounded-lg px-3 py-2 text-sm ring-1 ${exports[kind] ? "bg-green-50 ring-green-200" : "bg-slate-50 ring-slate-200"}`}
            >
              <span className="font-medium">{m.found[kind]}</span>
              <span className="block text-xs text-slate-500">
                {exports[kind] ? m.rows(exports[kind]!.rows.length) : "—"}
              </span>
            </li>
          ))}
        </ul>
        {unknown.map((name) => (
          <Alert key={name} tone="error">
            {m.unknown(name)}
          </Alert>
        ))}
        {clubCount !== null && (
          <p className="text-xs text-slate-500">{m.clubsSaved(clubCount)}</p>
        )}
      </section>

      <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="font-semibold">{m.linksTitle}</h2>
          <p className="text-sm text-slate-600">{m.linksIntro}</p>
        </div>
        <datalist id="federation-teams">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <ul className="divide-y divide-slate-100">
          {teams.map((team) => (
            <TeamLink
              key={team.id}
              team={team}
              divisionsOf={(name) => catalog.get(name.trim())}
              onSaved={(next) =>
                setTeams((all) => all.map((t) => (t.id === next.id ? next : t)))
              }
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">{m.importTitle}</h2>
        {divisions.size ? (
          <>
            <p className="text-sm text-slate-600">
              {m.importIntro([...linked].sort().join(", ") || "—")}
            </p>
            {clubs.size > 0 && (
              <p className="text-sm text-slate-600">
                {m.clubDivisions(
                  [...clubs].filter((d) => !linked.has(d)).length,
                )}
              </p>
            )}
            <p className="text-sm">
              {m.summary(
                payload.matches.length,
                payload.standings.length,
                payload.referees.length,
              )}
            </p>
            <Button
              type="button"
              disabled={pending || !parsed.length}
              onClick={() =>
                startTransition(async () => {
                  setResult(await importCompetition(payload));
                })
              }
            >
              {pending ? m.importing : m.import}
            </Button>
          </>
        ) : (
          <p className="text-sm text-slate-500">{m.noLinks}</p>
        )}
        {result?.error && <Alert tone="error">{result.error}</Alert>}
        {result?.counts && (
          <Alert tone="success">{m.done(result.counts)}</Alert>
        )}
      </section>
    </div>
  );
}

function TeamLink({
  team,
  divisionsOf,
  onSaved,
}: {
  team: Team;
  divisionsOf: (name: string) => Map<string, number> | undefined;
  onSaved: (team: Team) => void;
}) {
  const [name, setName] = useState(team.federationTeam);
  const [divisions, setDivisions] = useState(new Set(team.divisions));
  const [state, setState] = useState<{ error?: string; ok?: boolean }>({});
  const [pending, startTransition] = useTransition();
  const found = divisionsOf(name);
  // Divisions in the files for this name, plus the ones already linked.
  const options = [
    ...new Set([...(found ? [...found.keys()] : []), ...team.divisions]),
  ].sort();
  const changed =
    name.trim() !== team.federationTeam ||
    [...divisions].sort().join() !== [...team.divisions].sort().join();

  return (
    <li className="grid gap-3 py-3 lg:grid-cols-[14rem_18rem_minmax(0,1fr)_auto] lg:items-start">
      <div>
        <p className="font-medium">{team.clubName}</p>
        <p className="text-sm text-slate-500">
          {team.name}
          {team.archived && ` · ${m.archived}`}
        </p>
      </div>
      <input
        list="federation-teams"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label={`${m.teamName} — ${team.clubName} ${team.name}`}
        placeholder={m.teamPlaceholder}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-1.5" aria-label={m.divisions}>
        {options.length ? (
          options.map((code) => (
            <label
              key={code}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ${divisions.has(code) ? "bg-brand/15 ring-brand" : "bg-slate-50 ring-slate-200"}`}
            >
              <input
                type="checkbox"
                checked={divisions.has(code)}
                onChange={(event) =>
                  setDivisions((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(code);
                    else next.delete(code);
                    return next;
                  })
                }
              />
              <span className="font-semibold">{code}</span>
              {found?.get(code) ? (
                <span className="text-slate-500">
                  {m.matches(found.get(code)!)}
                </span>
              ) : null}
            </label>
          ))
        ) : (
          <span className="text-xs text-slate-500">{m.noDivisions}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={!changed || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await linkTeam(team.id, name, [...divisions]);
              setState(result);
              if (result.ok)
                onSaved({
                  ...team,
                  federationTeam: name.trim(),
                  divisions: [...divisions],
                });
            })
          }
        >
          {m.save}
        </Button>
        {state.ok && !changed && (
          <span className="text-xs text-green-700">{m.saved}</span>
        )}
        {state.error && (
          <span className="text-xs text-red-700">{state.error}</span>
        )}
      </div>
    </li>
  );
}
