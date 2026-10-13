# @iassistent/staff-engine

Leest de inhoud van de AI-staf uit `/staff` in en valideert de structuur.
Bevat bewust **geen** voetbalinhoud en (in fase 1) **geen** AI-calls.

```ts
import { loadStaff } from "@iassistent/staff-engine";

const staff = await loadStaff("/pad/naar/staff");
staff.roles.map((r) => r.meta.naam);
```

- `loadStaff(dir)` — leest alles in, gooit `StaffValidationError` bij fouten.
- `validateStaff(dir)` — geeft de lijst met problemen terug zonder te gooien.
- `pnpm validate` — CLI-controle van `/staff` (ook via `pnpm staff:validate` in de root).

Alleen server-side gebruiken (leest het bestandssysteem).
