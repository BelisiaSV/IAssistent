import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function TeamBadge({
  clubName,
  logoUrl,
  primaryColor,
  secondaryColor,
}: {
  clubName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={56}
        height={56}
        unoptimized
        className="h-14 w-14 rounded-full bg-white object-contain ring-1 ring-slate-200"
      />
    );
  }
  const initials = clubName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div
      aria-hidden
      className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold"
      style={{ backgroundColor: primaryColor, color: secondaryColor }}
    >
      {initials}
    </div>
  );
}

export function TeamCard({
  name,
  season,
  clubName,
  logoUrl,
  primaryColor,
  secondaryColor,
  badge,
  actions,
  href,
}: {
  name: string;
  season: string | null;
  clubName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  badge?: string;
  actions?: ReactNode;
  href?: string;
}) {
  const text = (
    <>
      <p className="truncate font-semibold">{clubName}</p>
      <p className="truncate text-sm text-slate-600">
        {name}
        {season ? ` · ${season}` : ""}
      </p>
      {badge && (
        <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {badge}
        </span>
      )}
    </>
  );

  return (
    <li
      className="flex items-center gap-4 rounded-xl border-l-8 bg-white p-4 shadow-sm ring-1 ring-slate-200"
      style={{ borderLeftColor: primaryColor }}
    >
      <TeamBadge
        clubName={clubName}
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
      />
      {href ? (
        <Link href={href} className="min-w-0 flex-1 hover:text-brand">
          {text}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{text}</div>
      )}
      {actions}
    </li>
  );
}
