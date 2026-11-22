import { containsPoint } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { hitAround, hitMargin, pressedArea } from "./hitAreas.ts";
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

  it("centres visible Menu and Exit faces in the shared top section with usable press targets", () => {
    const centre = layout.nav.y + layout.nav.height / 2;
    expect(PAUSE_BUTTON.art.y + PAUSE_BUTTON.art.height / 2).toBe(centre);
    expect(PAUSE_BUTTON.hit.y).toBeGreaterThanOrEqual(0);
    expect(PAUSE_BUTTON.hit.width).toBe(hitAround(PAUSE_BUTTON.art).width);
    if (layout.exit !== undefined) {
      const { art, hit } = layout.exit;
      expect(art.y + art.height / 2).toBe(centre);
      expect(art.x + art.width / 2).toBe(694);
      expect([art.width, art.height]).toEqual([PAUSE_BUTTON.art.width, PAUSE_BUTTON.art.height]);
      expect(hit).toEqual({ height: 54, width: 54, x: 667, y: 0 });
    }
  });

  it("takes the whole existing Exit target when Exit is present", () => {
    if (layout.exit === undefined) {
      return;
    }
    const { art, hit } = layout.exit;
    const areas = [{ art, hit, key: "exit" }];
    expect(pressedArea(areas, { x: hit.x, y: hit.y })).toBe("exit");
    expect(pressedArea(areas, { x: hit.x + hit.width - 1, y: hit.y + hit.height - 1 })).toBe(
      "exit",
    );
  });

  it("keeps Exit at its existing position and omits standalone menu actions", () => {
    const withExit = startScreenLayout(SCREEN, true, saved).exit!;
    if (layout.exit !== undefined) {
      expect(layout.exit).toEqual(withExit);
    }
    expect("achievements" in layout).toBe(false);
    expect("settings" in layout).toBe(false);
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
