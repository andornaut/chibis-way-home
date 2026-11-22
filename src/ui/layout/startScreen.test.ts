import { containsPoint } from "@andornaut/game-kit/runtime/rect";
import { BUTTON_GAP } from "@andornaut/game-kit/runtime/ui/spacing";
import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { hitAround, type PressArea, pressedArea } from "./hitAreas.ts";
import type { LabelledButton } from "./labelledButton.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";
import { type IconButtonLayout, startScreenLayout } from "./startScreen.ts";

const SCREEN_RECT: Rect = { ...SCREEN, x: 0, y: 0 };

function inside(outer: Rect, inner: Rect): boolean {
  return (
    containsPoint(outer, inner.x, inner.y) &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

const right = (rect: Rect) => rect.x + rect.width;

describe.each([
  ["with Exit, with no save", true, false],
  ["without Exit, with no save", false, false],
  ["with Exit and a save", true, true],
  ["without Exit, with a save", false, true],
])("the start screen %s", (_, exitShown, saved) => {
  const layout = startScreenLayout(SCREEN, exitShown, saved);
  const texts: [string, LabelledButton][] = [
    ["start", layout.start],
    ...(layout.restart === undefined
      ? []
      : [["restart", layout.restart] as [string, LabelledButton]]),
  ];
  const buttons: [string, IconButtonLayout][] = [
    ...(layout.exit === undefined ? [] : [["exit", layout.exit] as [string, IconButtonLayout]]),
  ];
  const areas: PressArea<string>[] = [
    ...texts.map(([key, { button, hit }]) => ({ art: button, hit, key })),
    ...buttons.map(([key, { art, hit }]) => ({ art, hit, key })),
  ];

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

  // A press anywhere on a drawn button takes that button, however the press areas overlap.
  it.each(areas)("takes every press on $key's drawn button as $key", ({ art, key }) => {
    const corners = [
      { x: art.x, y: art.y },
      { x: art.x + art.width - 1, y: art.y + art.height - 1 },
    ];
    expect(corners.map((point) => pressedArea(areas, point))).toEqual([key, key]);
  });

  it("keeps Exit at its existing position and omits standalone menu actions", () => {
    const withExit = startScreenLayout(SCREEN, true, saved).exit!;
    if (layout.exit !== undefined) {
      expect(layout.exit).toEqual(withExit);
    }
    expect("achievements" in layout).toBe(false);
    expect("settings" in layout).toBe(false);
  });

  it.each(texts)(
    "sizes %s like standard card actions, under the nav bar, on the screen",
    (__, { button }) => {
      expect({
        below: button.y >= layout.nav.y + layout.nav.height,
        height: button.height,
        onScreen: inside(SCREEN_RECT, button),
      }).toEqual({ below: true, height: TEXT_BUTTON.height, onScreen: true });
    },
  );

  it("shows Restart left of Continue only with a save, the pair centred on Start", () => {
    const alone = startScreenLayout(SCREEN, exitShown, false).start.button;
    const { restart, start } = layout;
    const row = restart && {
      centre: (restart.button.x + right(start.button)) / 2,
      gap: start.button.x - right(restart.button),
      matchingSize:
        start.button.width === restart.button.width &&
        start.button.height === restart.button.height,
      y: restart.button.y,
    };
    expect(row).toEqual(
      saved
        ? { centre: alone.x + alone.width / 2, gap: BUTTON_GAP, matchingSize: true, y: alone.y }
        : undefined,
    );
  });
});

it.each([
  { height: 193, width: 558 },
  { height: 239, width: 558 },
  { height: 100, width: SCREEN.width * 2 },
])("fits the $width x $height logo above unchanged controls at its natural aspect", (size) => {
  const baseline = startScreenLayout(SCREEN, true, true);
  const layout = startScreenLayout(size, true, true);
  const { logo, nav, start } = layout;
  expect(logo.x + logo.width / 2).toBe(SCREEN.width / 2);
  expect(logo.y).toBeGreaterThan(nav.y + nav.height);
  expect(logo.width / logo.height).toBeCloseTo(size.width / size.height);
  expect(logo.y + logo.height).toBeLessThan(start.hit.y);
  expect(inside(SCREEN_RECT, logo)).toBe(true);
  expect({ ...layout, logo: baseline.logo }).toEqual(baseline);
});
