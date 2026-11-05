import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { countrysideVerticalId } from "../data/chunks";
import { TILE } from "../data/screen";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { zonePlanOf } from "./assemble";
import { contactBox } from "./behaviour";
import { advanceTraversal, type BehaviourTraversalState } from "./behaviourTraversal";
import { objectLayout, zoneLayout } from "./tiles";
import { CHUNK_LIBRARY } from "./zonePlans";

it("reaches the actual narrow left post from the countryside climb yard", () => {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "country-lanes", 2, [
    countrysideVerticalId("city-boundary-climb-yard"),
  ]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const object = area.objects.find((object) => object.character === "goose-antagonist")!;
  const motion = object.behaviour!.states.pursuit!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw new Error("Expected production ground pursuit");
  }
  const platforms = area.objects
    .filter((object) => object.collision === "solid" || object.collision === "ledge")
    .map((owner) => ({
      after: { ...owner.origin, height: owner.height, width: owner.width },
      before: { ...owner.origin, height: owner.height, width: owner.width },
      collision: owner.collision as "solid" | "ledge",
      owner,
    }));
  const post = area.solids
    .filter(
      (rect) => rect.x < object.origin.x && rect.y < object.origin.y && rect.width === object.width,
    )
    .at(-1)!;
  const ledge = platforms.find(
    ({ after }) => after.y === post.y && after.x + after.width === post.x,
  )!;
  const target = {
    height: BIRD.height,
    width: BIRD.width,
    x: post.x + (post.width - BIRD.width) / 2,
    y: post.y - BIRD.height,
  };
  let at = object.origin;
  let prior: BehaviourTraversalState | undefined;
  let prepared = false;
  let jumped = false;
  for (let tick = 0; tick < 360; tick++) {
    const world = {
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
    const next = advanceTraversal(world, object, motion, STEP_SECONDS, prior, at, target);
    at = next.at;
    prior = next.traversal;
    prepared ||= Boolean(prior?.preparation);
    jumped ||= (prior?.physical.vy ?? 0) < 0;
    if (prior?.physical.grounded && at.y + object.height === post.y) {
      expect(prepared).toBe(true);
      expect(jumped).toBe(true);
      expect(at.x + object.hitbox!.x).toBeGreaterThanOrEqual(ledge.after.x);
      expect(at.x + object.hitbox!.x + object.hitbox!.width).toBeLessThanOrEqual(
        post.x + post.width,
      );
      return;
    }
  }
  expect.fail(JSON.stringify({ at, prior }));
});

it.each([-1, 1] as const)(
  "descends the open ridge through proved local support facing %s",
  (move) => {
    const object = objectLayout(TILE, CATALOGUE, HITBOXES, undefined, TILESETS, {
      character: "dog-antagonist",
      col: 32,
      row: 34,
    });
    const motion = object.behaviour!.states.pursuit!.motion;
    if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
      throw new Error("Expected production ground pursuit");
    }
    const fastest = Math.max(motion.speed, motion.traversal.speed);
    const terrain = [
      [0, 8, 50],
      [8, 9, 46],
      [17, 12, 42],
      [29, 10, 38],
      [39, 8, 43],
      [47, 7, 47],
      [54, 6, 50],
    ] as const;
    const solids = terrain.map(([col, cols, row]) => ({
      height: (60 - row) * TILE,
      width: cols * TILE,
      x: col * TILE,
      y: row * TILE,
    }));
    const bank = move === 1 ? solids.at(-1)! : solids[0]!;
    const target = {
      height: BIRD.height,
      width: BIRD.width,
      x: move === 1 ? bank.x + bank.width - BIRD.width - TILE : bank.x + TILE,
      y: bank.y - BIRD.height,
    };
    let at = object.origin;
    let prior: BehaviourTraversalState | undefined;
    let landings = 0;
    for (let tick = 0; tick < 600; tick++) {
      const next = advanceTraversal(
        {
          solids,
          traversalFrame: {
            bounds: { height: 60 * TILE, width: 60 * TILE, x: 0, y: 0 },
            dtSeconds: STEP_SECONDS,
            platforms: [],
            sample: () => [],
            timeSeconds: tick * STEP_SECONDS,
          },
        },
        object,
        motion,
        STEP_SECONDS,
        prior,
        at,
        target,
      );
      if (next.traversal?.physical.grounded && !prior?.physical.grounded) {
        landings++;
      }
      expect(Math.abs(next.at.x - at.x)).toBeLessThanOrEqual(fastest * STEP_SECONDS + 1e-6);
      at = next.at;
      prior = next.traversal;
      if (prior?.physical.grounded && at.y + object.height === bank.y) {
        expect(landings).toBeGreaterThan(1);
        const left = at.x + object.hitbox!.x;
        expect(left).toBeGreaterThanOrEqual(bank.x);
        expect(left + object.hitbox!.width).toBeLessThanOrEqual(bank.x + bank.width);
        return;
      }
    }
    expect.fail(JSON.stringify({ at, prior }));
  },
);

it("crosses the offset terrace through its actual supported upper bridge", () => {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "city-streets", 2, [
    "offset-two-level-terrace-encounter",
  ]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const object = area.objects.find((owner) => owner.behaviour?.pursuit)!;
  const motion = object.behaviour!.states.pursuit!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw new Error("Expected production ground pursuit");
  }
  const platforms = area.objects
    .filter((owner) => owner.collision === "solid" || owner.collision === "ledge")
    .map((owner) => ({
      after: { ...owner.origin, height: owner.height, width: owner.width },
      before: { ...owner.origin, height: owner.height, width: owner.width },
      collision: owner.collision as "solid" | "ledge",
      owner,
    }));
  const hazards = area.objects
    .filter((owner) => owner !== object && owner.collision === "hazard")
    .map((owner) => ({ owner, rect: contactBox(owner, owner.origin, 1) }));
  const bank = area.solids.at(-1)!;
  const target = {
    height: BIRD.height,
    width: BIRD.width,
    x: bank.x + bank.width - BIRD.width - TILE,
    y: bank.y - BIRD.height,
  };
  let at = object.origin;
  let prior: BehaviourTraversalState | undefined;
  let prepared = false;
  let supportedBridge = false;
  for (let tick = 0; tick < 600; tick++) {
    const next = advanceTraversal(
      {
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
      },
      object,
      motion,
      STEP_SECONDS,
      prior,
      at,
      target,
    );
    at = next.at;
    prior = next.traversal;
    prepared ||= Boolean(prior?.preparation);
    supportedBridge ||= Boolean(
      prior?.physical.grounded &&
      platforms.some(({ owner }) => owner === prior?.physical.supportId),
    );
    if (prior?.physical.grounded && at.y + object.height === bank.y) {
      expect(prepared).toBe(true);
      expect(supportedBridge).toBe(true);
      const left = at.x + object.hitbox!.x;
      expect(left).toBeGreaterThanOrEqual(bank.x);
      expect(left + object.hitbox!.width).toBeLessThanOrEqual(bank.x + bank.width);
      return;
    }
  }
  expect.fail(JSON.stringify({ at, prior }));
});
