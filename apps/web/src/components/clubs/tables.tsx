import { messages } from "@/lib/messages";
import { longDate } from "@/lib/weeks/dates";

import { ConfirmButton } from "./forms";

const m = messages.clubAdmin;
const dateTime = new Intl.DateTimeFormat("nl-BE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Brussels",
});

/** An expiry moment that has passed (read at request time). */
function isPast(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() <= Date.now();
}

export interface CodeRow {
  id: string;
  code_hint: string;
  role: string;
  team_id: string | null;
  team_role: string | null;
  note: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

/** The activation codes of a club; open codes can be revoked. */
export function CodesTable({
  clubId,
  codes,
  teamName,
  revoke,
}: {
  clubId: string;
  codes: CodeRow[];
  teamName: Map<string, string>;
  revoke: (formData: FormData) => Promise<void>;
}) {
  if (!codes.length)
    return <p className="text-sm text-slate-600">{m.codes.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">{m.codes.columns.code}</th>
            <th className="py-2 pr-3 font-medium">{m.codes.columns.role}</th>
            <th className="py-2 pr-3 font-medium">{m.codes.columns.team}</th>
            <th className="py-2 pr-3 font-medium">{m.codes.columns.note}</th>
            <th className="py-2 pr-3 font-medium">{m.codes.columns.status}</th>
            <th className="py-2 pr-3 font-medium">{m.codes.columns.created}</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {codes.map((code) => {
            const status =
              code.status === "open" && isPast(code.expires_at)
                ? "expired"
                : code.status;
            return (
              <tr key={code.id}>
                <td className="py-2 pr-3 font-mono">
                  {m.codes.endsWith(code.code_hint)}
                </td>
                <td className="py-2 pr-3">{m.roles[code.role]}</td>
                <td className="py-2 pr-3">
                  {code.team_id
                    ? `${teamName.get(code.team_id) ?? "—"} · ${m.teamRoles[code.team_role ?? ""] ?? ""}`
                    : "—"}
                </td>
                <td className="py-2 pr-3">{code.note ?? "—"}</td>
                <td className="py-2 pr-3">{m.codes.status[status]}</td>
                <td className="py-2 pr-3 text-slate-500">
                  {dateTime.format(new Date(code.created_at))}
                </td>
                <td className="py-2 text-right">
                  {status === "open" && (
                    <form action={revoke}>
                      <input type="hidden" name="clubId" value={clubId} />
                      <input type="hidden" name="codeId" value={code.id} />
                      <ConfirmButton
                        label={m.codes.revoke}
                        confirmText={m.codes.revokeConfirm}
                      />
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface PersonRow {
  coach_id: string;
  name: string | null;
  email: string;
  roles: string[] | null;
  license_id: string | null;
  license_status: string | null;
  active: boolean;
  since: string;
}

/**
 * The people of a club with their roles and licence. With `revokeLicense`, an
 * active licence can be revoked; with `endRole` and the member ids of roles
 * without a licence (admin, coordinator), those can be ended.
 */
export function PeopleTable({
  clubId,
  people,
  revokeLicense,
  endRole,
  roleMembers,
}: {
  clubId: string;
  people: PersonRow[];
  revokeLicense?: (formData: FormData) => Promise<void>;
  endRole?: (formData: FormData) => Promise<void>;
  roleMembers?: { id: string; coach_id: string; role: string }[];
}) {
  if (!people.length)
    return <p className="text-sm text-slate-600">{m.members.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">{m.members.columns.name}</th>
            <th className="py-2 pr-3 font-medium">{m.members.columns.email}</th>
            <th className="py-2 pr-3 font-medium">{m.members.columns.roles}</th>
            <th className="py-2 pr-3 font-medium">
              {m.members.columns.license}
            </th>
            <th className="py-2 pr-3 font-medium">{m.members.columns.since}</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {people.map((p) => {
            const unlicensed = (roleMembers ?? []).filter(
              (r) =>
                r.coach_id === p.coach_id &&
                (r.role === "admin" || r.role === "team_coordinator"),
            );
            return (
              <tr key={p.coach_id} className={p.active ? "" : "text-slate-400"}>
                <td className="py-2 pr-3 font-medium">{p.name ?? "—"}</td>
                <td className="py-2 pr-3">{p.email}</td>
                <td className="py-2 pr-3">
                  {p.active
                    ? (p.roles ?? []).map((r) => m.roles[r]).join(", ")
                    : m.members.former}
                </td>
                <td className="py-2 pr-3">
                  {p.license_status === "active"
                    ? m.members.licenseActive
                    : p.license_status === "revoked"
                      ? m.members.licenseRevoked
                      : m.members.noLicense}
                </td>
                <td className="py-2 pr-3">{longDate(p.since.slice(0, 10))}</td>
                <td className="space-y-1 py-2 text-right">
                  {revokeLicense &&
                    p.license_status === "active" &&
                    p.license_id && (
                      <form action={revokeLicense}>
                        <input type="hidden" name="clubId" value={clubId} />
                        <input
                          type="hidden"
                          name="licenseId"
                          value={p.license_id}
                        />
                        <ConfirmButton
                          label={m.members.revoke}
                          confirmText={m.members.revokeConfirm}
                        />
                      </form>
                    )}
                  {endRole &&
                    unlicensed.map((r) => (
                      <form key={r.id} action={endRole}>
                        <input type="hidden" name="clubId" value={clubId} />
                        <input type="hidden" name="memberId" value={r.id} />
                        <ConfirmButton
                          label={`${m.members.endRole}: ${m.roles[r.role]}`}
                          confirmText={messages.club.licenses.endRoleConfirm}
                        />
                      </form>
                    ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The club's history, newest first. */
export function HistoryList({
  entries,
  personName,
  teamName,
}: {
  entries: {
    id: number;
    action: string;
    coach_id: string | null;
    team_id: string | null;
    created_at: string;
  }[];
  personName: Map<string, string>;
  teamName: Map<string, string>;
}) {
  if (!entries.length)
    return <p className="text-sm text-slate-600">{m.history.empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {entries.map((h) => (
        <li key={h.id} className="flex flex-wrap gap-x-3 py-2">
          <span className="w-40 shrink-0 text-slate-500">
            {dateTime.format(new Date(h.created_at))}
          </span>
          <span className="font-medium">
            {m.history.actions[h.action] ?? h.action}
          </span>
          {h.coach_id && (
            <span className="text-slate-600">
              {personName.get(h.coach_id) ?? ""}
            </span>
          )}
          {h.team_id && (
            <span className="text-slate-600">
              {teamName.get(h.team_id) ?? ""}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
