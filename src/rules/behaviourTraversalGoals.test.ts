import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { countrysideVerticalId } from "../data/chunks";
import { TILE } from "../data/screen";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { zonePlanOf } from "./assemble";
import { advanceTraversal, type BehaviourTraversalState } from "./behaviourTraversal";
import { STEP_SECONDS } from "./step";
import { zoneLayout } from "./tiles";
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
