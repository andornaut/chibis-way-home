import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { BIRD } from "../data/bird";
import { OUTDOOR_LIFT_ASCENT_TRANSIT } from "../data/forcedTransit";
import { TILE } from "../data/screen";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { type ChunkLibrary, themesOf, zonePlanOf } from "./assemble";
import { startBird } from "./bird";
import { zoneLayout } from "./tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "./zone";
import { CHUNK_LIBRARY } from "./zonePlans";

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };

// The certified lift contract on its own base chunk, the city-lift instance only.
function liftLayout() {
  const chunk = CHUNK_LIBRARY.chunks["outdoor-lift-ascent"]!;
  const library: ChunkLibrary = {
    ...CHUNK_LIBRARY,
    chunks: {
      ...CHUNK_LIBRARY.chunks,
      "outdoor-lift-ascent": {
        ...chunk,
        objects: chunk.objects.map((instance) =>
          instance.character === "city-lift"
            ? { ...instance, forcedTransit: OUTDOOR_LIFT_ASCENT_TRANSIT }
            : instance,
        ),
      },
    },
  };
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, themesOf(chunk)[0]!, 2, [
    "outdoor-lift-ascent",
  ]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

it("protects a lower-dock boarding through the lift's forced window until safe ground", () => {
  const layout = liftLayout();
  const objects = layout.areas.main!.objects;
  const lift = objects.findIndex(({ forcedTransit }) => forcedTransit);
  const { banks, group } = objects[lift]!.forcedTransit!;
  const lower = banks.find(({ id }) => id === "lower")!;
  const dock = objects[lift]!.origin;
  const supported = (state: ZoneState) =>
    state.bird.x < state.objects[lift]!.x + objects[lift]!.width &&
    state.bird.x + BIRD.width > state.objects[lift]!.x;
  let state = startZone(BIRD, layout, 42);
  state = { ...state, bird: startBird(BIRD, { x: lower.x + 24, y: lower.y }) };
  const until = (input: ZoneInput, done: (state: ZoneState) => boolean, check = () => {}) => {
    for (let tick = 0; tick < 2000 && !done(state); tick++) {
      state = stepZone(BIRD, layout, 1 / 120, input, state);
      check();
    }
    expect(done(state)).toBe(true);
    expect(state.death).toBeUndefined();
  };

  until(STILL, (state) => state.bird.grounded && state.objects[lift]!.y === dock.y);
  let straddled = 0;
  until(
    { ...STILL, move: 1 },
    (state) => state.bird.x >= lower.x + lower.width,
    () => {
      if (state.bird.grounded && supported(state) && state.bird.x < lower.x + lower.width) {
        straddled++;
        expect(state.forcedTransit?.episode).toBeUndefined();
      }
    },
  );
  expect(straddled).toBeGreaterThan(0);
  until(STILL, (state) => state.forcedTransit?.episode !== undefined);
  expect(state.forcedTransit).toMatchObject({
    attackWindow: "allowed",
    episode: { boardingBank: "lower", group, phase: "boarding" },
  });

  until(STILL, (state) => state.forcedTransit?.attackWindow === "deferred");
  expect(state.objects[lift]!.y).toBeLessThan(dock.y - 2 * TILE);
  expect(state.forcedTransit?.episode?.phase).toBe("forced");

  until(
    { ...STILL, move: -1 },
    (state) => state.bird.grounded && !supported(state),
    () => {
      if (!state.bird.grounded) {
        expect(state.forcedTransit?.attackWindow).toBe("deferred");
      }
    },
  );
  expect(state.bird.y + BIRD.height).toBe(lower.y);
  // Observation reads the state the step starts from.
  state = stepZone(BIRD, layout, 1 / 120, STILL, state);
  expect(state.forcedTransit).toEqual({
    attackWindow: "allowed",
    boardingAdmissions: [{ group, id: "lower" }],
    evidence: "certified",
  });
});
