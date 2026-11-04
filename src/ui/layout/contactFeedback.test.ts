import { containsPoint } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { CAMERA } from "../../data/camera";
import { CONTACT_CUE } from "../../data/feedback";
import { SCREEN } from "../../data/screen";
import {
  contactBorder,
  contactCueOn,
  contactOverscan,
  contactWorldOffset,
} from "./contactFeedback";

const tuning = CAMERA.contactShake!;
const view = { ...SCREEN, x: 0, y: 0 };

describe("red contact presentation", () => {
  it("uses the paired diagonal jolts, neutral interval and integer settling, then returns to zero", () => {
    expect(contactWorldOffset(tuning, 0)).toEqual({ x: tuning.distance, y: tuning.distance });
    expect(contactWorldOffset(tuning, tuning.firstOffMs)).toEqual({ x: 0, y: 0 });
    expect(contactWorldOffset(tuning, tuning.secondOnMs)).toEqual({
      x: -tuning.distance,
      y: -tuning.distance,
    });
    const halfway = (tuning.secondOffMs + tuning.durationMs) / 2;
    const offset = contactWorldOffset(tuning, halfway);
    expect(offset.x).toBe(offset.y);
    expect(Number.isInteger(offset.x)).toBe(true);
    expect(Math.abs(offset.x)).toBeLessThan(tuning.distance);
    expect(contactWorldOffset(tuning, tuning.durationMs)).toEqual({ x: 0, y: 0 });
  });

  it("keeps reduced-motion feedback steadily visible during the normal flash's off interval", () => {
    expect(contactCueOn(tuning, CONTACT_CUE, false, tuning.firstOffMs)).toBe(false);
    expect(contactCueOn(tuning, CONTACT_CUE, true, tuning.firstOffMs)).toBe(true);
    expect(contactCueOn(tuning, CONTACT_CUE, true, CONTACT_CUE.durationMs)).toBe(false);
    const border = contactBorder(CONTACT_CUE, view);
    expect(border.band).toHaveLength(4);
    expect(border.keyline).toHaveLength(4);
  });

  it("fills every viewport corner with actual edge-pixel copies at either maximum displacement", () => {
    const padding = contactOverscan(tuning.distance, view);
    expect(padding).toHaveLength(8);
    for (const { source } of padding) {
      expect(source.width === 1 || source.height === 1).toBe(true);
      expect(source.x + source.width).toBeLessThanOrEqual(SCREEN.width);
      expect(source.y + source.height).toBeLessThanOrEqual(SCREEN.height);
    }
    for (const displacement of [-tuning.distance, tuning.distance]) {
      const painted = [view, ...padding.map(({ target }) => target)].map((rect) => ({
        ...rect,
        x: rect.x + displacement,
        y: rect.y + displacement,
      }));
      for (const x of [0, SCREEN.width - 1]) {
        for (const y of [0, SCREEN.height - 1]) {
          expect(painted.some((rect) => containsPoint(rect, x, y))).toBe(true);
        }
      }
    }
  });
});
