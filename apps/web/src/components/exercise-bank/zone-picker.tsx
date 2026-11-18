"use client";

import { useState } from "react";

import { ZoneMap } from "./zone-map";

/** The zones as a form field: click a zone to add or remove it (hidden input "zones" = "1,2,3"). */
export function ZonePicker({ name, initial }: { name: string; initial: number[] }) {
  const [zones, setZones] = useState(initial);
  return (
    <div className="w-44">
      <ZoneMap
        zones={zones}
        className="w-full"
        onToggle={(zone) => setZones((all) => (all.includes(zone) ? all.filter((z) => z !== zone) : [...all, zone].sort((a, b) => a - b)))}
      />
      <input type="hidden" name={name} value={zones.join(",")} />
    </div>
  );
}
