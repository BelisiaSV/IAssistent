import "server-only";

import { formationCatalog } from "@/lib/staff";

/** The formation of a team on the dashboard: its default formation, else the first of the catalogue. */
export function teamFormation(code: string | null) {
  return formationCatalog.formaties.find((f) => f.code === code) ?? formationCatalog.formaties[0]!;
}
