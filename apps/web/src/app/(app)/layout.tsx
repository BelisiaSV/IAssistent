import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/teams" className="text-lg font-semibold text-brand">
            {messages.app.name}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/teams" className="text-slate-700 hover:text-brand">
              {messages.nav.teams}
            </Link>
            <Link href="/exercises" className="text-slate-700 hover:text-brand">
              {messages.nav.exercises}
            </Link>
            <Link href="/profile/vision" className="text-slate-700 hover:text-brand">
              {messages.nav.vision}
            </Link>
            <span className="hidden text-slate-400 sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-slate-700 hover:text-brand">
                {messages.nav.signOut}
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
