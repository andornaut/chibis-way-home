import { findTraversal } from "@andornaut/game-kit/terrain/traversal";
import { describe, expect, it, vi } from "vitest";

import { zonePlanOf } from "../rules/assemble";
import { contactBox } from "../rules/behaviour";
import type { BehaviourWorld } from "../rules/behaviourReach";
import { advanceTraversal, type BehaviourTraversalState } from "../rules/behaviourTraversal";
import { STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { BIRD } from "./bird";
import { TILE } from "./screen";

vi.mock("@andornaut/game-kit/terrain/traversal", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/traversal")>();
  return { ...actual, findTraversal: vi.fn(actual.findTraversal) };
});

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const cases = [
  { col: 20, floor: 30, id: "city-boundary-dog-high", theme: "city-streets" },
  { col: 20, floor: 40, id: "city-boundary-dog-terrace", theme: "city-streets" },
  { col: 16, floor: 50, id: "patrol-cover-early", theme: "city-streets" },
  { col: 24, floor: 50, id: "patrol-cover-middle", theme: "city-streets" },
  { col: 16, floor: 50, id: "growl-cover-early", theme: "deep-woods" },
  { col: 24, floor: 50, id: "growl-cover-middle", theme: "deep-woods" },
  { col: 24, floor: 40, id: "growl-clearing", theme: "deep-woods" },
  { col: 32, floor: 50, id: "flyer-shelter-early", theme: "loading-yards" },
  { col: 42, floor: 50, id: "flyer-shelter-middle", theme: "loading-yards" },
];
function layoutOf(theme: string, id: string) {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, theme, 2, [id]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

describe.each(cases)("ordinary climb $id", ({ col, floor, id, theme }) => {
  it("requires a jump and crosses with one ordinary jump and a safe landing", () => {
    const base = layoutOf(theme, id);
    const areaId = base.start.area;
    const area = base.areas[areaId]!;
    const layout = {
      ...base,
      areas: {
        ...base.areas,
        [areaId]: {
          ...area,
          entries: {
            ...area.entries,
            [base.start.entry]: {
              x: (col - 3) * TILE + ordinary.width / 2,
              y: floor * TILE,
            },
          },
          objects: area.objects.filter((object) => !object.behaviour?.pursuit),
        },
      },
    };
    const start = () =>
      stepZone(ordinary, layout, STEP_SECONDS, idle, startZone(ordinary, layout, 1));
    let walking = start();
    for (let tick = 0; tick < 120; tick++) {
      walking = stepZone(ordinary, layout, STEP_SECONDS, { ...idle, move: 1 }, walking);
    }
    expect(walking.death).toBeUndefined();
    expect(walking.bird.x + ordinary.width).toBeLessThanOrEqual(col * TILE + 1e-6);
    let zone = start();
    for (let tick = 0; tick < 360; tick++) {
      zone = stepZone(
        ordinary,
        layout,
        STEP_SECONDS,
        { ...idle, jumpHeld: tick * STEP_SECONDS < ordinary.jumpRiseTime, move: 1 },
        zone,
      );
      expect(zone.death).toBeUndefined();
      if (zone.bird.grounded && zone.bird.x >= (col + 5) * TILE) {
        expect(zone.bird.dash).toBeUndefined();
        return;
      }
    }
    expect.fail(JSON.stringify({ bird: zone.bird, id }));
  });
});

it.each(cases.filter(({ id }) => ["patrol-cover-early", "growl-clearing"].includes(id)))(
  "production ground boss jumps and lands beyond $id obstruction",
  ({ col, floor, id, theme }) => {
    const layout = layoutOf(theme, id);
    const area = layout.areas[layout.start.area]!;
    const object = area.objects.find((object) => object.behaviour?.pursuit)!;
    const motion = object.behaviour!.states.pursuit!.motion;
    if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
      throw new Error("Expected the production ground pursuit profile");
    }
    const platforms = area.objects.flatMap((owner) => {
      if (owner.collision !== "solid" && owner.collision !== "ledge") {
        return [];
      }
      const rect = { ...owner.origin, height: owner.height, width: owner.width };
      return [{ after: rect, before: rect, collision: owner.collision, owner }];
    });
    const hazards = area.objects
      .filter((owner) => owner.collision === "hazard")
      .map((owner) => ({ owner, rect: contactBox(owner, owner.origin, 1) }));
    const target = {
      height: ordinary.height,
      width: ordinary.width,
      x: (col - 5) * TILE,
      y: floor * TILE - ordinary.height,
    };
    vi.mocked(findTraversal).mockClear();
    let at = object.origin;
    let traversal: BehaviourTraversalState | undefined;
    let jumped = false;
    for (let tick = 0; tick < 480; tick++) {
      const world: BehaviourWorld = {
        hazards,
        platforms: platforms.map(({ after, collision, owner }) => ({
          collision,
          owner,
          rect: after,
        })),
        solids: area.solids,
        traversalFrame: {
          bounds: { height: area.height, width: area.width, x: 0, y: 0 },
          dtSeconds: STEP_SECONDS,
          platforms,
          sample: () => platforms,
          timeSeconds: tick * STEP_SECONDS,
        },
      };
      const next = advanceTraversal(world, object, motion, STEP_SECONDS, traversal, at, target);
      at = next.at;
      traversal = next.traversal;
      jumped ||= (traversal?.physical.vy ?? 0) < 0;
      if (traversal?.physical.grounded && at.x + object.width <= col * TILE) {
        expect(jumped).toBe(true);
        expect(at.y + object.height).toBeCloseTo(floor * TILE);
        return;
      }
    }
    const searches = vi.mocked(findTraversal).mock.results.map(({ value }) => ({
      status: value.status,
      work: value.work,
    }));
    expect.fail(
      JSON.stringify({ at, goal: traversal?.target, id, searches, status: traversal?.status }),
    );
  },
);
