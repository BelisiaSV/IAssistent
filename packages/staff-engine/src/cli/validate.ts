import path from "node:path";

import { loadStaff, StaffValidationError } from "../index";

const dir = path.resolve(process.argv[2] ?? "staff");

try {
  const staff = await loadStaff(dir);
  console.log(`✔ /staff is geldig (${staff.roles.length} rollen, ${staff.shared.length} gedeelde bestanden)`);
  for (const role of staff.roles) {
    console.log(`  - ${role.id} — ${role.meta.naam} [${role.meta.status}, v${role.meta.versie}]`);
  }
} catch (error) {
  if (error instanceof StaffValidationError) {
    console.error(`✘ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
