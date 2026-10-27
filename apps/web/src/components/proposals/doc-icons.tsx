import type { SVGProps } from "react";

/** Small line icons for the printable documents (24 × 24, stroke = currentColor). */
const paths = {
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  timer: "M10 2h4M12 14l3-3M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  gauge: "m12 14 4-4M3.3 19a10 10 0 1 1 17.4 0",
  target: "M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  flag: "M4 22V4m0 0s1.5-1 4-1 4 2 6.5 2S19 4 19 4v10s-1.5 1-4.5 1S10 13 8 13s-4 1-4 1",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  ball: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 7l4.5 3.3-1.7 5.2H9.2L7.5 10.3 12 7ZM12 7V3M16.5 10.3l4-1.3M14.8 15.5l2.5 3.5M9.2 15.5l-2.5 3.5M7.5 10.3l-4-1.3",
  check: "m5 12 4 4L19 6",
  arrow: "M7 17 17 7M9 7h8v8",
  users: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M2 21v-2a4 4 0 0 1 3-3.9",
  ruler: "M3 17 17 3l4 4L7 21l-4-4ZM7 13l2 2M10 10l2 2M13 7l2 2",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-2 6-6 2 2-6 6-2Z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z",
  plane: "M2 16l20-8-20-8 4 8-4 8Zm4-8h8",
} as const;

export type DocIconName = keyof typeof paths;

export function DocIcon({ name, className = "h-4 w-4", ...props }: { name: DocIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
