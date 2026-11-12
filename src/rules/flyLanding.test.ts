import { rectsOverlap } from "@andornaut/game-kit/rect";
import { expect, it } from "vitest";

import { STEP_SECONDS } from "../core/index.ts";
import { TILE } from "../data/screen.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { flyLandingRoute } from "./flyLanding.ts";
import { objectLayout } from "./tiles.ts";

const place = (character: string, col: number, row: number) =>
  objectLayout(TILE, CATALOGUE, HITBOXES, TILESETS["tiles-street"], {}, { character, col, row });

// Pebble returning to ground where a ground hazard shuttles, as in loading-yards seed 3: the
// hazard is away now, but its lane runs under him.
it("lands clear of a moving hazard's lane, not where it is now", () => {
  const pebble = place("pigeon-antagonist", 40, 20);
  const shuttle = place("city-ground-hazard", 20, 49);
  const floor = { height: 120, width: 1440, x: 0, y: 600 };
  const now = { height: 4, width: 48, x: 240, y: 596 };
  const lane = { height: 4, width: 600, x: 240, y: 596 };
  const world: BehaviourWorld = {
    hazards: [{ boundsAt: () => lane, owner: shuttle, rect: now }],
    solids: [floor],
    traversalFrame: {
      bounds: { height: 720, width: 1440, x: 0, y: 0 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds: 0,
    },
  };
  const route = flyLandingRoute(pebble, world, pebble.origin)!;
  const landing = route.at(-1)!;
  expect(landing.y + pebble.height).toBe(floor.y);
  expect(rectsOverlap({ ...landing, height: pebble.height, width: pebble.width }, lane)).toBe(
    false,
  );
});
