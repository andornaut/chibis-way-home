import { describe, expect, it } from "vitest";

import type { Archetype } from "../data/types";
import { areaLayout, objectLayout } from "./tiles";

const profile = { absentSeconds: 2, warningSeconds: 0.8 };
const archetype: Archetype = {
  collision: "solid",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const catalogue = {
  archetypes: { support: archetype },
  characters: { support: { archetype: "support", art: "fixture", cols: 3, rows: 2 } },
};
const instance = { character: "support", col: 4, row: 8 };
const plan = {
  cols: 60,
  entries: { start: { col: 1, row: 8 } },
  objects: [instance],
  rows: 60,
  solids: [{ col: 0, cols: 10, row: 10, rows: 3 }],
};

describe("crumbling authoring boundary", () => {
  it("rejects hidden terrain underlays but allows touching edges and independent object skins", () => {
    const marked = { ...plan.solids[0]!, crumbling: profile };
    expect(() =>
      areaLayout(12, catalogue, {}, {}, new Set(), {
        ...plan,
        solids: [marked, { ...plan.solids[0]!, row: marked.row + 1 }],
      }),
    ).toThrow("must not overlap another terrain collider");
    expect(() =>
      areaLayout(12, catalogue, {}, {}, new Set(), {
        ...plan,
        solids: [marked, { ...plan.solids[0]!, col: marked.col + marked.cols }],
      }),
    ).not.toThrow();
    const objectUnderlay = areaLayout(12, catalogue, {}, {}, new Set(), {
      ...plan,
      objects: [{ ...instance, crumbling: profile, row: marked.row }],
    });
    expect(objectUnderlay.crumbling![0]!.supportId).toBe(objectUnderlay.objects[0]);
  });

  it("preserves omitted metadata and binds terrain and object definitions to actual collider identities", () => {
    const plain = areaLayout(12, catalogue, {}, {}, new Set(), plan);
    expect(plain).not.toHaveProperty("crumbling");
    expect(plain.objects[0]).not.toHaveProperty("crumbling");
    const marked = areaLayout(12, catalogue, {}, {}, new Set(), {
      ...plan,
      objects: [{ ...instance, crumbling: profile }],
      solids: [{ ...plan.solids[0]!, crumbling: profile }],
    });
    expect(marked.crumbling).toHaveLength(2);
    expect(marked.crumbling![0]!.supportId).toBe(marked.solids[0]);
    expect(marked.crumbling![0]!.volume).toEqual({ height: 36, width: 120, x: 0, y: 120 });
    expect(marked.crumbling![1]!.supportId).toBe(marked.objects[0]);
    expect(marked.crumbling![1]!.volume).toEqual({ height: 24, width: 36, x: 48, y: 96 });
    expect(marked.crumbling!.map(({ profile: value }) => value)).toEqual([profile, profile]);
    expect(marked.solids).toEqual(plain.solids);
  });

  it.each(["solid", "ledge"] as const)("retains stationary %s support metadata", (collision) => {
    const object = objectLayout(
      12,
      { ...catalogue, archetypes: { support: { ...archetype, collision } } },
      {},
      undefined,
      {},
      { ...instance, crumbling: profile },
    );
    expect(object.crumbling).toBe(profile);
    expect(object.collision).toBe(collision);
  });

  it.each([
    { absentSeconds: 0, warningSeconds: 0.8 },
    { absentSeconds: 2, warningSeconds: Infinity },
  ])("rejects invalid timing rather than substituting gameplay defaults: %j", (crumbling) => {
    expect(() =>
      areaLayout(12, catalogue, {}, {}, new Set(), {
        ...plan,
        solids: [{ ...plan.solids[0]!, crumbling }],
      }),
    ).toThrow("finite positive seconds");
  });

  it.each([
    { collision: "hazard" as const },
    { collision: "none" as const },
    { motion: { ...archetype.motion, algorithm: "linear" as const } },
    { reaction: { ...archetype.reaction, kind: "avoid" as const } },
  ])("rejects nonstationary or non-support archetypes: %j", (patch) => {
    expect(() =>
      objectLayout(
        12,
        { ...catalogue, archetypes: { support: { ...archetype, ...patch } } },
        {},
        undefined,
        {},
        { ...instance, crumbling: profile },
      ),
    ).toThrow("stationary physical support");
  });

  it("rejects behaviour, orbit and explicit motion/reaction overrides even when visually stationary", () => {
    const patches = [
      { overrides: { motion: { algorithm: "static" as const } } },
      { overrides: { reaction: { kind: "none" as const } } },
      { orbit: { angularSpeed: 1, host: "host", phase: 0, radius: 2 } },
      {
        behaviour: {
          axis: "x" as const,
          distance: 0,
          initial: "wait",
          states: { wait: { animation: null, motion: { kind: "wait" as const }, transitions: [] } },
        },
      },
    ];
    for (const patch of patches) {
      expect(() =>
        objectLayout(
          12,
          catalogue,
          {},
          undefined,
          {},
          { ...instance, crumbling: profile, ...patch },
        ),
      ).toThrow("stationary physical support");
    }
  });
});
