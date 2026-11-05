import { containsPoint } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { SCREEN } from "../../data/screen";
import type { Rect } from "../../data/types";
import { TEXT_BUTTON } from "./buttonLabel";
import { type PressArea, pressedArea } from "./hitAreas";
import type { LabelledButton } from "./restartCard";
import { type IconButtonLayout, startScreenLayout } from "./startScreen";

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
    ["achievements", layout.achievements],
    ["settings", layout.settings],
    ...(layout.exit === undefined ? [] : [["exit", layout.exit] as [string, IconButtonLayout]]),
  ];
  const areas: PressArea<string>[] = [
    ...texts.map(([key, { button, hit }]) => ({ art: button, hit, key })),
    ...buttons.map(([key, { art, hit }]) => ({ art, hit, key })),
  ];

  // A press anywhere on a drawn button takes that button, however the press areas overlap.
  it.each(areas)("takes every press on $key's drawn button as $key", ({ art, key }) => {
    const corners = [
      { x: art.x, y: art.y },
      { x: art.x + art.width - 1, y: art.y + art.height - 1 },
    ];
    expect(corners.map((point) => pressedArea(areas, point))).toEqual([key, key]);
  });

  it("ends the nav with Exit, or with Settings in Exit's place where there is no Exit", () => {
    const last = layout.exit ?? layout.settings;
    const withExit = startScreenLayout(SCREEN, true, saved).exit;
    expect({
      lastIsExit: last === layout.exit,
      settingsBeforeExit:
        layout.exit === undefined || right(layout.settings.art) <= layout.exit.art.x,
      x: last.at.x,
    }).toEqual({ lastIsExit: exitShown, settingsBeforeExit: true, x: withExit?.at.x });
  });

  it("shows Achievements immediately left of Settings, one nav slot apart", () => {
    const slot = startScreenLayout(SCREEN, true, saved);
    expect({
      gap: layout.settings.art.x - right(layout.achievements.art),
      sameRow: layout.achievements.art.y === layout.settings.art.y,
      slot: layout.settings.at.x - layout.achievements.at.x,
    }).toEqual({
      gap: slot.exit!.art.x - right(slot.settings.art),
      sameRow: true,
      slot: slot.exit!.at.x - slot.settings.at.x,
    });
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
      clear: right(restart.button) < start.button.x,
      matchingSize:
        start.button.width === restart.button.width &&
        start.button.height === restart.button.height,
      y: restart.button.y,
    };
    expect(row).toEqual(
      saved
        ? { centre: alone.x + alone.width / 2, clear: true, matchingSize: true, y: alone.y }
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
