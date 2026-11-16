import type { CSSProperties } from "react";

import { messages } from "@/lib/messages";

import { RoleAvatar, staffColor } from "./role-avatar";

const m = messages.staffRoom.meeting;

export type FlowState = "waiting" | "active" | "done";

/**
 * The roles of the meeting as cards in a row, connected by lines on which
 * light runs towards the role that is speaking now, ending in the overview.
 */
export function FlowBar({
  steps,
  overview,
  roleNames,
}: {
  steps: { role: string; state: FlowState }[];
  overview: FlowState;
  roleNames: Record<string, string>;
}) {
  const nodes = [...steps.map((s) => ({ key: s.role, role: s.role, state: s.state })), { key: "overview", role: null, state: overview }];
  return (
    <div aria-label={m.flow} className="overflow-x-auto rounded-2xl bg-slate-900 px-3 py-3 ring-1 ring-white/10">
      <ol className="flex w-full min-w-max items-center sm:min-w-0">
        {nodes.map((node, i) => {
          const color = node.role ? staffColor(node.role) : "#22c55e";
          const previous = i > 0 ? nodes[i - 1]! : null;
          const previousColor = previous?.role ? staffColor(previous.role) : color;
          return (
            <li key={node.key} className={`flex items-center ${previous ? "flex-1" : ""}`}>
              {previous && <Connector from={previousColor} to={color} state={node.state} />}
              <div
                title={node.role ? (roleNames[node.role] ?? node.role) : m.flowDone}
                className={`flex w-[80px] shrink-0 flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center transition ${node.state === "active" ? "glow-pulse" : ""} ${
                  node.state === "waiting" ? "border-white/10 opacity-50" : ""
                }`}
                style={
                  {
                    "--glow": `${color}99`,
                    borderColor: node.state === "waiting" ? undefined : `${color}cc`,
                    backgroundColor: node.state === "waiting" ? "rgb(255 255 255 / 0.03)" : `${color}1f`,
                  } as CSSProperties
                }
              >
                {node.role ? (
                  <RoleAvatar member={node.role} size={28} muted={node.state === "waiting"} />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-slate-950" style={{ backgroundColor: color }}>
                    ✓
                  </span>
                )}
                <span className="flex w-full flex-col">
                  <span className="line-clamp-2 min-h-[2lh] text-[11px] leading-tight font-semibold text-white">{node.role ? (roleNames[node.role] ?? node.role) : m.flowDone}</span>
                  <span className="truncate text-[9px] font-medium tracking-wide uppercase" style={{ color: node.state === "waiting" ? "#64748b" : color }}>
                    {messages.staffRoom.flowState[node.state]}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Connector({ from, to, state }: { from: string; to: string; state: FlowState }) {
  const lit = state !== "waiting";
  return (
    <span aria-hidden className="relative mx-0.5 block h-[3px] min-w-3 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: lit ? undefined : "rgb(255 255 255 / 0.08)" }}>
      {lit && (
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 10px ${to}`, opacity: state === "active" ? 0.35 : 0.9 }}
        />
      )}
      {state === "active" && (
        <>
          <span className="flow-dot absolute top-1/2 h-[5px] w-3 -translate-y-1/2 rounded-full" style={{ backgroundColor: "#fff", boxShadow: `0 0 8px 2px ${to}` }} />
          <span className="flow-dot-late absolute top-1/2 h-[5px] w-3 -translate-y-1/2 rounded-full" style={{ backgroundColor: "#fff", boxShadow: `0 0 8px 2px ${to}` }} />
        </>
      )}
    </span>
  );
}
