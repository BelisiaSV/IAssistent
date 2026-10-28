import { readableOn, shade } from "@/lib/proposals/overview";

/** A token as on the animated pitch: a disc with a rim and a shadow, optionally with a number. */
export function KitToken({ color, label, size = 44 }: { color: string; label?: string; size?: number }) {
  const id = `kit-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 48 52" width={size} height={(size * 52) / 48} aria-hidden>
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={shade(color, -0.35)} />
          <stop offset="1" stopColor={color} />
        </radialGradient>
      </defs>
      <ellipse cx="24" cy="46" rx="18" ry="4" fill="#0f172a" opacity="0.18" />
      <circle cx="24" cy="26" r="19" fill={shade(color, 0.35)} />
      <circle cx="24" cy="23" r="19" fill={`url(#${id})`} />
      <circle cx="24" cy="23" r="15" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
      {label && (
        <text x="24" y="28.5" textAnchor="middle" fontSize="15" fontWeight="700" fill={readableOn(color)}>
          {label}
        </text>
      )}
    </svg>
  );
}
