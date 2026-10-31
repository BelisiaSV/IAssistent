"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Shows the team banner on every team page except the dashboard, which has its own header. */
export function TeamHeader({ teamId, children }: { teamId: string; children: ReactNode }) {
  return usePathname() === `/teams/${teamId}` ? null : children;
}
