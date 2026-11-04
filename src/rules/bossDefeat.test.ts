import { expect, it } from "vitest";

import { BOSS_REMOVAL_SECONDS } from "../data/behaviours";
import type { ZoneLayout } from "../data/types";
import { chunksLayout, ORDINARY, withInstances } from "../testing/encounterLayouts";
import { startBird } from "./bird";
import { STEP_SECONDS } from "./step";
import {
  activateBehaviour,
  retryZone,
  startZone,
  stepZone,
  type ZoneInput,
  type ZoneState,
} from "./zone";

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };

// The crumbling crossing with an extra Archie on its far bank, then a patrol chunk whose own
// Archie is the stage's next encounter.
function fixture() {
  const layout: ZoneLayout = chunksLayout(
    "city-streets",
    ["crumbling-support-crossing", "patrol-cover-middle"],
    withInstances("crumbling-support-crossing", [
      { character: "dog-antagonist", col: 44, role: "antagonist", row: 46 },
    ]),
  );
  const area = layout.areas[layout.start.area]!;
  const dogs = area.objects.flatMap((object, index) =>
    object.character === "dog-antagonist" ? [index] : [],
  );
  const pit = area.objects.find(({ character }) => character === "red-edge-top")!;
  const first = dogs.reduce((a, b) =>
    area.objects[a]!.origin.x < area.objects[b]!.origin.x ? a : b,
  );
  const next = dogs.find((index) => index !== first)!;
  const start = (): ZoneState =>
    dogs.reduce((zone, index) => activateBehaviour(index, zone), startZone(ORDINARY, layout, 1));
  return { area, first, layout, next, pit, start };
}

type Fixture = ReturnType<typeof fixture>;

function run(f: Fixture, start: ZoneState, ticks: number) {
  const barks: ZoneState["barks"][number][] = [];
  let zone = start;
  for (let tick = 0; tick < ticks && !zone.death; tick++) {
    zone = stepZone(ORDINARY, f.layout, STEP_SECONDS, STILL, zone);
    barks.push(...zone.barks);
  }
  return { barks, zone };
}

// The first Archie stood in the red pit, or below the level.
function placed(f: Fixture, y: (object: Fixture["area"]["objects"][number]) => number): ZoneState {
  const zone = f.start();
  const object = f.area.objects[f.first]!;
  const objects = zone.objects.slice();
  objects[f.first] = { x: f.pit.origin.x + 48, y: y(object) };
  return { ...zone, objects };
}

it.each([
  [
    "touching a red hazard",
    (f: Fixture) => (o: { height: number }) => f.pit.origin.y + 12 - o.height,
  ],
  ["falling out of the level", (f: Fixture) => () => f.area.height + 12],
] as const)("a boss dies %s, loses collision and ends its pursuit", (_, height) => {
  const f = fixture();
  const { zone } = run(f, placed(f, height(f)), 1);
  const state = zone.behaviours[f.first]!;
  expect(state.defeat).toEqual({ seconds: 0 });
  expect(state.pursuit).toBeUndefined();
  expect(zone.defeated).toEqual({ [zone.area]: [f.first] });
  // Its removal runs once, and the dead boss no longer kills Chibi on contact.
  const after = run(f, zone, Math.ceil(BOSS_REMOVAL_SECONDS / STEP_SECONDS) + 2).zone;
  expect(after.behaviours[f.first]!.defeat).toEqual({ seconds: BOSS_REMOVAL_SECONDS });
  const touching = run(
    f,
    {
      ...after,
      bird: startBird(ORDINARY, {
        x: after.objects[f.first]!.x,
        y: after.objects[f.first]!.y + 24,
      }),
    },
    1,
  ).zone;
  expect(touching.death?.contact).not.toEqual(expect.objectContaining({ index: f.first }));
});

it("a boss death is no escape, leaves the next encounter and returns on a retry", () => {
  const f = fixture();
  const dead = run(
    f,
    placed(f, (o) => f.pit.origin.y + 12 - o.height),
    1,
  ).zone;
  const floor = f.area.entries.start!.y;
  // Chibi meets the next encounter, which acquires her, then leaves beyond its escape distance.
  const met = run(
    f,
    { ...dead, bird: startBird(ORDINARY, { x: f.area.width - 60, y: floor }) },
    30,
  );
  expect(met.zone.behaviours[f.next]!.pursuit?.phase).toBe("engaged");
  const left = run(f, { ...met.zone, bird: startBird(ORDINARY, f.area.entries.start!) }, 2);
  const escapes = [...met.barks, ...left.barks].filter(({ line }) => line === "archie-escaped");
  expect(escapes.map(({ owner }) => owner.objectIndex)).toEqual([f.next]);
  expect(left.zone.behaviours[f.next]!.pursuit?.phase).toBe("escaped");
  expect(left.zone.behaviours[f.first]!.pursuit).toBeUndefined();
  // A retry restores the area, the dead boss included.
  const retried = retryZone(ORDINARY, f.layout, {
    ...left.zone,
    death: {
      position: left.zone.bird,
      reason: "fall",
      support: undefined,
      velocity: { x: 0, y: 0 },
    },
  });
  expect(retried.defeated).toBeUndefined();
  expect(retried.behaviours[f.first]!.defeat).toBeUndefined();
  expect(retried.behaviours[f.next]!.defeat).toBeUndefined();
});
