import { describe, expect, it } from "vitest";

import { HAZARD_OUTLINE } from "../data/screen";
import { contains } from "../rules/rect";
import { hazardOutline } from "./hazardOutline";

const BOX = { height: 38, width: 56, x: 72, y: 100 };

describe("hazardOutline", () => {
  it("keeps the complete outline inside the exact contact box", () => {
    for (const { rect } of hazardOutline(HAZARD_OUTLINE, BOX)) {
      expect(rect.x).toBeGreaterThanOrEqual(BOX.x);
      expect(rect.y).toBeGreaterThanOrEqual(BOX.y);
      expect(rect.x + rect.width).toBeLessThanOrEqual(BOX.x + BOX.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(BOX.y + BOX.height);
    }
  });

  it("draws the configured bands and leaves the centre clear", () => {
    const parts = hazardOutline(HAZARD_OUTLINE, BOX);
    for (let y = 0; y < BOX.height; y++) {
      for (let x = 0; x < BOX.width; x++) {
        const edge = Math.min(x, y, BOX.width - 1 - x, BOX.height - 1 - y);
        const band = parts.find(({ rect }) =>
          contains(rect, { x: BOX.x + x + 0.5, y: BOX.y + y + 0.5 }),
        )?.band;
        expect(band).toBe(
          edge < HAZARD_OUTLINE.redWidth
            ? "colour"
            : edge < HAZARD_OUTLINE.width
              ? "backing"
              : undefined,
        );
      }
    }
  });

  it.each([
    { ...BOX, height: 1 },
    { ...BOX, width: 1 },
  ])("never draws beyond a small collider %j", (box) => {
    for (const { rect } of hazardOutline(HAZARD_OUTLINE, box)) {
      expect(rect.width).toBeGreaterThanOrEqual(0);
      expect(rect.height).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(box.y + box.height);
    }
  });
});
