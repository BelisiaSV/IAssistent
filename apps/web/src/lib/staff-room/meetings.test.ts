import { describe, expect, it } from "vitest";

import { currentOverview, meetingConversation, speakingOrder, toMeetingView, turnOutput } from "./meetings";

const meeting = {
  id: "m", team_id: "t", assignment: "Omschakeling", status: "ready" as const, version: 2, feedbacks: ["Korter graag"],
  created_at: "", decided_at: null,
};
const turn = (version: number, position: number, role: string, kind: "opening" | "bijdrage" | "reactie" | "overzicht", bericht: string, overzicht: unknown = null) => ({
  id: `${version}-${position}`, version, position, role, kind, status: "ready" as const, provider: "example",
  output: { bericht, aan: null, overzicht },
});
const overview = { titel: "T", samenvatting: "S", onderdelen: [{ titel: "a", inhoud: "b", rol: "physical-coach" }], aandachtspunten: [], weekplan: null };

describe("staff meetings", () => {
  const view = toMeetingView(meeting, [
    turn(2, 1, "coordinator", "opening", "v2 open"),
    turn(1, 2, "coordinator", "overzicht", "v1 klaar", overview),
    turn(1, 1, "team-manager", "bijdrage", "15 spelers"),
    turn(2, 2, "coordinator", "overzicht", "v2 klaar", { ...overview, titel: "T2" }),
  ]);

  it("orders the turns by version and position and finds the current overview", () => {
    expect(view.turns.map((t) => t.id)).toEqual(["1-1", "1-2", "2-1", "2-2"]);
    expect(currentOverview(view)?.titel).toBe("T2");
  });

  it("gives the next speaker the conversation with the feedback of the head coach in between", () => {
    expect(meetingConversation(view, 2, 2).map((m) => `${m.van}:${m.bericht}`)).toEqual([
      "team-manager:15 spelers",
      "coordinator:v1 klaar",
      "hoofdcoach:Korter graag",
      "coordinator:v2 open",
    ]);
  });

  it("lists who speaks in a version and ignores malformed output", () => {
    expect(speakingOrder(view.turns, 1)).toEqual(["team-manager", "coordinator"]);
    expect(turnOutput({ bericht: 1 })).toBeNull();
    expect(turnOutput({ bericht: "x", aan: null, overzicht: { titel: "t" } })?.overzicht).toBeNull();
  });
});
