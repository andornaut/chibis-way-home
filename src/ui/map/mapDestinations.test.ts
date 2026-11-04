import { describe, expect, it } from "vitest";

import { TILE } from "../../data/screen";
import { openMap } from "../../rules/map";
import {
  DESTINATION_FIXTURE as MAP,
  DESTINATION_PLANS as PLANS,
} from "../../testing/mapDestinations";
import { MAP_SCREEN } from "../layout/mapScreen";
import {
  destinationAtTap,
  destinationCentre,
  destinationPathLook,
  destinationState,
} from "./mapDestinations";

const FIRST = MAP.destinations[0]!;
const SECOND = MAP.destinations[1]!;

describe("destination marks", () => {
  it.each([
    { completed: [], destination: FIRST, stand: "one", state: "current" },
    { completed: ["one", "two"], destination: FIRST, stand: "one", state: "current" },
    { completed: [], destination: SECOND, stand: "one", state: "locked" },
    { completed: ["one", "two"], destination: FIRST, stand: "three", state: "visited" },
    { completed: ["one", "two"], destination: SECOND, stand: "one", state: "normal" },
  ])("$destination.id is $state", ({ completed, destination, stand, state }) => {
    expect(
      destinationState(
        PLANS,
        MAP,
        openMap(MAP, new Set(completed)),
        new Set(completed),
        stand,
        destination,
      ),
    ).toBe(state);
  });
  it("marks unbuilt destination art unavailable and does not accept its tap", () => {
    const plans = new Set(["one", "two"]);
    const open = openMap(MAP, new Set(["one", "two"]));
    expect(destinationState(plans, MAP, open, new Set(), "one", SECOND)).toBe("unbuilt");
    expect(
      destinationAtTap(TILE, MAP_SCREEN.nodeHit, plans, MAP, open, destinationCentre(TILE, SECOND)),
    ).toBeUndefined();
  });
  it("changes a destination path only when its built stages become unlocked", () => {
    expect(destinationPathLook(PLANS, MAP, openMap(MAP, new Set()), SECOND)).toBe("built");
    expect(destinationPathLook(PLANS, MAP, openMap(MAP, new Set(["one", "two"])), SECOND)).toBe(
      "open",
    );
    expect(destinationPathLook(new Set(["one"]), MAP, openMap(MAP, new Set()), SECOND)).toBe(
      "unbuilt",
    );
  });
});
