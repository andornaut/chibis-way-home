import { describe, expect, it } from "vitest";

import type { Rect } from "../data/types";
import { collisionCandidates } from "./collisionIndex";

const shared: Rect = { height: 20, width: 40, x: 120, y: 0 };
const terrain: readonly Rect[] = [
  { height: 20, width: 30, x: 4000, y: 0 },
  { height: 20, width: 2000000, x: -1000000, y: 100 },
  shared,
  { height: 10, width: 128, x: -128, y: 0 },
  { height: 10, width: 128, x: 0, y: 0 },
  shared,
];

describe("immutable terrain candidates", () => {
  it.each([
    { height: 20, width: 128, x: -128, y: 0 },
    { height: 20, width: 40, x: 120, y: 0 },
    { height: Infinity, width: 10, x: 120, y: 50 },
    { height: 200, width: 2000000, x: -1000000, y: -50 },
  ])("matches a full ordered scan for %j", (bounds) => {
    const expected = terrain.filter(
      (rect) =>
        rect.x <= bounds.x + bounds.width &&
        rect.x + rect.width >= bounds.x &&
        rect.y <= bounds.y + bounds.height &&
        rect.y + rect.height >= bounds.y,
    );
    const indexed = collisionCandidates(terrain, bounds);
    expect(indexed).toEqual(expected);
    indexed.forEach((rect, index) => expect(rect).toBe(expected[index]));
  });

  it("keeps independent terrain identities separate when reusing query bounds", () => {
    const bounds = { height: 20, width: 40, x: 120, y: 0 };
    const original = [shared];
    const changed = [{ ...shared, x: 4000 }];
    expect(collisionCandidates(original, bounds)).toEqual([shared]);
    expect(collisionCandidates(changed, bounds)).toEqual([]);
    expect(collisionCandidates(original, bounds)).toEqual([shared]);
  });
});
