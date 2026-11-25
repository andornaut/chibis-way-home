import { containsPoint } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { hitMargin, pressedArea } from "./hitAreas.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";
import { startScreenLayout } from "./startScreen.ts";

const SCREEN_RECT: Rect = { ...SCREEN, x: 0, y: 0 };

function inside(outer: Rect, inner: Rect): boolean {
  return (
    containsPoint(outer, inner.x, inner.y) &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

describe.each([
  ["with Exit, with no save", true, false],
  ["without Exit, with no save", false, false],
  ["with Exit and a save", true, true],
  ["without Exit, with a save", false, true],
])("the start screen %s", (_, exitShown, saved) => {
  const layout = startScreenLayout(SCREEN, exitShown, saved);

  it("puts Exit's frame on whole pixels at the top section's centre, with the hit rule's target", () => {
    if (layout.exit === undefined) {
      return;
    }
    const { art, hit } = layout.exit;
    const centre = layout.nav.y + layout.nav.height / 2;
    expect(art).toEqual({ height: 35, width: 35, x: 676, y: 6 });
    expect([art.width, art.height]).toEqual([PAUSE_BUTTON.art.width, PAUSE_BUTTON.art.height]);
    // An odd frame in an even section sits half a pixel above the centre.
    expect(centre - (art.y + art.height / 2)).toBe(0.5);
    const margin = Math.ceil(hitMargin(art));
    expect(hit).toEqual({ height: 53, width: 53, x: 667, y: 0 });
    expect(hit.width).toBe(art.width + 2 * margin);
    expect(hit.x).toBe(art.x - margin);
    expect(inside(SCREEN_RECT, hit)).toBe(true);
    expect(inside(hit, art)).toBe(true);
  });

  it("takes a press anywhere in Exit's target", () => {
    if (layout.exit === undefined) {
      return;
    }
    const { art, hit } = layout.exit;
    const areas = [{ art, hit, key: "exit" }];
    expect(pressedArea(areas, { x: hit.x, y: hit.y })).toBe("exit");
    expect(pressedArea(areas, { x: hit.x + hit.width - 1, y: hit.y + hit.height - 1 })).toBe(
      "exit",
    );
    expect(pressedArea(areas, { x: hit.x - 1, y: hit.y })).toBeUndefined();
  });

  it("reserves the standard action height below the nav and preserves save visibility", () => {
    expect(layout.actionY).toBeGreaterThanOrEqual(layout.nav.y + layout.nav.height);
    expect(layout.actionY + TEXT_BUTTON.height).toBeLessThanOrEqual(SCREEN.height);
    expect(layout.saved).toBe(saved);
  });
});

it.each([
  { height: 193, width: 558 },
  { height: 239, width: 558 },
  { height: 100, width: SCREEN.width * 2 },
])("fits the $width x $height logo above unchanged controls at its natural aspect", (size) => {
  const baseline = startScreenLayout(SCREEN, true, true);
  const layout = startScreenLayout(size, true, true);
  const { actionY, logo, nav } = layout;
  expect(logo.x + logo.width / 2).toBe(SCREEN.width / 2);
  expect(logo.y).toBeGreaterThan(nav.y + nav.height);
  expect(logo.width / logo.height).toBeCloseTo(size.width / size.height);
  const { height } = TEXT_BUTTON;
  expect(logo.y + logo.height).toBeLessThan(
    actionY - hitMargin({ height, width: height, x: 0, y: 0 }),
  );
  expect(inside(SCREEN_RECT, logo)).toBe(true);
  expect({ ...layout, logo: baseline.logo }).toEqual(baseline);
});
