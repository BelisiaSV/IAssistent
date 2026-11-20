import Link from "next/link";

import { loadMyClubs } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";

import { JoinForm } from "./join-form";

const m = messages.club.join;

/** Any signed-in user: redeem an activation code from a club. */
export default async function JoinClubPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const clubs = await loadMyClubs();
  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <JoinForm code={(code ?? "").slice(0, 20)} />
      </section>
      {clubs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">
            {m.yourClubs}
          </h2>
          <ul className="space-y-1">
            {clubs.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clubs/${c.id}`}
                  className="text-brand hover:underline"
                >
                  {c.name}
                </Link>
                <span className="ml-2 text-sm text-slate-500">
                  {c.roles.map((r) => messages.clubAdmin.roles[r]).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
