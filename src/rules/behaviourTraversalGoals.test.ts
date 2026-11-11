import { expect, it } from "vitest";

import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { advanceTraversal, type BehaviourTraversalState } from "./behaviourTraversal";
import { objectLayout } from "./tiles";

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
