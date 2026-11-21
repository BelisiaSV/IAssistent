"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { messages } from "@/lib/messages";

import { checkImport, type ImportState, runImport } from "./actions";

const m = messages.playerImport;

/** Check and import the Excel of one team (in a window on its row). */
export function ImportForm({ teamId }: { teamId: string }) {
  const [checked, check, checking] = useActionState<ImportState, FormData>(
    checkImport,
    {},
  );
  const [imported, importAction, importing] = useActionState<
    ImportState,
    FormData
  >(runImport, {});
  const preview =
    checked.preview && checked.preview.teamId === teamId
      ? checked.preview
      : null;
  const ready = preview && preview.errorCount === 0 && !imported.done;

  return (
    <form action={check} className="space-y-4">
      <input type="hidden" name="teamId" value={teamId} />
      <Field label={m.file}>
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm"
        />
      </Field>

      {(checked.error || imported.error) && (
        <Alert tone="error">{imported.error ?? checked.error}</Alert>
      )}
      {imported.done && (
        <Alert tone="success">
          {m.done(imported.done.inserted, imported.done.updated)}{" "}
          <Link
            href={`/teams/${imported.done.teamId}/players`}
            className="font-medium underline"
          >
            {m.toTeam}
          </Link>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={checking}>
          {checking ? m.checking : m.check}
        </Button>
        {ready && (
          <Button type="submit" formAction={importAction} disabled={importing}>
            {importing ? m.importing : m.import(preview.rows.length)}
          </Button>
        )}
      </div>

      {preview && (
        <section className="space-y-2">
          <h2 className="font-semibold">{m.preview}</h2>
          {preview.errorCount > 0 && (
            <Alert tone="error">{m.errorsFound(preview.errorCount)}</Alert>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="py-1 pr-3">{m.line}</th>
                  <th className="py-1 pr-3">{m.columns.shirtNumber}</th>
                  <th className="py-1 pr-3">{m.columns.lastName}</th>
                  <th className="py-1 pr-3">{m.columns.primaryPosition}</th>
                  <th className="py-1">{m.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((r) => (
                  <tr
                    key={r.line}
                    className={r.errors.length ? "bg-red-50" : ""}
                  >
                    <td className="py-1 pr-3 tabular-nums text-slate-500">
                      {r.line}
                    </td>
                    <td className="py-1 pr-3 tabular-nums">
                      {r.shirtNumber ?? "–"}
                    </td>
                    <td className="py-1 pr-3">{r.name || "–"}</td>
                    <td className="py-1 pr-3">{r.position ?? "–"}</td>
                    <td className="py-1">
                      {r.errors.length ? (
                        <span className="text-red-700">
                          {r.errors.join(" ")}
                        </span>
                      ) : r.update ? (
                        m.actionUpdate
                      ) : (
                        m.actionNew
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </form>
  );
}
