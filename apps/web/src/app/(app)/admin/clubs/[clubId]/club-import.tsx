"use client";

import { useActionState, useRef } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { hasErrors } from "@/lib/clubs/import";
import { messages } from "@/lib/messages";

import { checkClubImport, type ImportState, runClubImport } from "../actions";
import { CopyButton } from "@/components/clubs/forms";

const m = messages.clubAdmin;
const x = m.excel;

/** CSV of the codes (";" for Excel in Dutch), downloaded in the browser only. */
function downloadCodes(
  clubName: string,
  codes: {
    name: string;
    role: string;
    team: string | null;
    team_role: string | null;
    code: string;
  }[],
) {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const rows = [
    [
      x.columns.staffName,
      x.columns.role,
      x.columns.team,
      x.columns.teamRole,
      m.codes.columns.code,
    ],
    ...codes.map((c) => [
      c.name,
      m.roles[c.role] ?? c.role,
      c.team ?? "",
      c.team_role ? (m.teamRoles[c.team_role] ?? "") : "",
      c.code,
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(quote).join(";")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `codes-${clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Upload the filled-in Excel: check first (nothing saved), then import with the same file. */
export function ClubImport({
  clubId,
  clubName,
}: {
  clubId: string;
  clubName: string;
}) {
  const [checked, check, checking] = useActionState<ImportState, FormData>(
    checkClubImport.bind(null, clubId),
    {},
  );
  const [imported, run, running] = useActionState<ImportState, FormData>(
    runClubImport.bind(null, clubId),
    {},
  );
  const form = useRef<HTMLFormElement>(null);
  const preview = checked.preview;
  const done = imported.done;
  const error = imported.error ?? checked.error;
  const ready = preview && !hasErrors(preview.data) && !preview.blocker;
  const existing = new Set(
    (preview?.existingTeams ?? []).map((t) => t.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{x.intro}</p>
      <a
        href={`/admin/clubs/${clubId}/template`}
        className="inline-block rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-200"
      >
        {x.download}
      </a>

      <form
        ref={form}
        action={check}
        className="flex flex-wrap items-end gap-3"
      >
        <Field label={x.file}>
          <input
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="block text-sm"
          />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          disabled={checking || running}
        >
          {checking ? x.checking : x.check}
        </Button>
        {ready && !done && (
          <Button type="submit" formAction={run} disabled={checking || running}>
            {running ? x.checking : x.import}
          </Button>
        )}
      </form>

      {error && <Alert tone="error">{error}</Alert>}

      {preview && !done && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <h3 className="font-semibold">{x.preview}</h3>
          <p className="text-sm text-slate-700">
            {x.seatsNeeded(preview.seatsNeeded, preview.seatsFree)}
          </p>
          {preview.blocker && <Alert tone="error">{preview.blocker}</Alert>}
          {hasErrors(preview.data) && <Alert tone="error">{x.fixErrors}</Alert>}

          <div className="text-sm">
            <p className="font-medium">{x.clubRow}</p>
            <p className="text-slate-700">
              {[
                preview.data.club.name,
                preview.data.club.address,
                preview.data.club.contactName,
                preview.data.club.contactEmail,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            {preview.data.clubErrors.map((err) => (
              <p key={err} className="text-red-700">
                {err}
              </p>
            ))}
          </div>

          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">{x.sheets.teams}</th>
                <th className="py-1 pr-3 font-medium">
                  {x.columns.ageCategory}
                </th>
                <th className="py-1 pr-3 font-medium">
                  {x.columns.federationTeam}
                </th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {preview.data.teams.map((t) => (
                <tr key={t.line}>
                  <td className="py-1.5 pr-3">{t.name || "—"}</td>
                  <td className="py-1.5 pr-3">
                    {t.ageCategory
                      ? (messages.ageCategories as Record<string, string>)[
                          t.ageCategory
                        ]
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {t.federationTeam || "—"}
                    {t.divisions.length ? ` (${t.divisions.join(", ")})` : ""}
                  </td>
                  <td className="py-1.5 text-xs">
                    {t.errors.length ? (
                      <span className="text-red-700">
                        {x.line(x.sheets.teams, t.line)}: {t.errors.join(" ")}
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        {existing.has(t.name.toLowerCase())
                          ? x.existingTeam
                          : x.newTeam}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">{x.sheets.staff}</th>
                <th className="py-1 pr-3 font-medium">{x.columns.role}</th>
                <th className="py-1 pr-3 font-medium">{x.columns.team}</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {preview.data.staff.map((s) => (
                <tr key={s.line}>
                  <td className="py-1.5 pr-3">{s.name || "—"}</td>
                  <td className="py-1.5 pr-3">
                    {s.role ? m.roles[s.role] : "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {s.team || "—"}
                    {s.teamRole ? ` · ${m.teamRoles[s.teamRole]}` : ""}
                  </td>
                  <td className="py-1.5 text-xs text-red-700">
                    {s.errors.length
                      ? `${x.line(x.sheets.staff, s.line)}: ${s.errors.join(" ")}`
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {done && (
        <div className="space-y-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <Alert tone="success">
            {x.done(done.teamsCreated, done.teamsUpdated)}
          </Alert>
          {done.codes.length > 0 && (
            <>
              <h3 className="font-semibold text-emerald-950">{x.codesTitle}</h3>
              <p className="text-sm text-emerald-900">{x.codesIntro}</p>
              <button
                type="button"
                onClick={() => downloadCodes(clubName, done.codes)}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                {x.downloadCodes}
              </button>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-emerald-200">
                  {done.codes.map((c) => (
                    <tr key={c.code}>
                      <td className="py-1.5 pr-3">{c.name}</td>
                      <td className="py-1.5 pr-3">
                        {m.roles[c.role] ?? c.role}
                      </td>
                      <td className="py-1.5 pr-3">{c.team ?? "—"}</td>
                      <td className="py-1.5 pr-3 font-mono font-bold tracking-wider">
                        {c.code}
                      </td>
                      <td className="py-1.5">
                        <CopyButton text={c.code} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
