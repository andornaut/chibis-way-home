import { containsPoint, rectsOverlap } from "@andornaut/game-kit/rect";
import { HIT_RULE } from "@andornaut/game-kit/ui/hitAreas";
import { describe, expect, it } from "vitest";

import buttonSheet from "../../../public/art/sprites/ui-button.json" with { type: "json" };
import resumeSheet from "../../../public/art/sprites/ui-resume.json" with { type: "json" };
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { pressedArea } from "./hitAreas.ts";
import { CELEBRATION, type LabelledButton } from "./restartCard.ts";

const SCREEN_RECT: Rect = { ...SCREEN, x: 0, y: 0 };
const frameOf = (sheet: { frames: Record<string, { frame: { h: number; w: number } }> }) => {
  const { h: height, w: width } = Object.values(sheet.frames)[0]?.frame ?? { h: 0, w: 0 };
  return { height, width };
};

function inside(outer: Rect, inner: Rect): boolean {
  return (
    containsPoint(outer, inner.x, inner.y) &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

// Each card's button faces and press areas.
const CARDS: [string, Rect, [string, LabelledButton][]][] = [
  [
    "celebration",
    CELEBRATION.card,
    [
      ["restart", CELEBRATION.restart],
      ["continue", CELEBRATION.continue],
    ],
  ],
];

describe.each(CARDS)("the %s", (_, card, buttons) => {
  const areas = buttons.map(([key, { button, hit }]) => ({ art: button, hit, key }));

  it("holds its buttons on the screen, none overlapping, each a touch target", () => {
    const [first, second] = buttons.map(([, { button }]) => button);
    expect({
      apart: first !== undefined && second !== undefined && !rectsOverlap(first, second),
      inside: buttons.every(([, { button }]) => inside(card, button)),
      onScreen: inside(SCREEN_RECT, card),
      targets: buttons.every(
        ([, { hit }]) => Math.min(hit.width, hit.height) >= HIT_RULE.minTarget,
      ),
    }).toEqual({ apart: true, inside: true, onScreen: true, targets: true });
  });

  it.each(areas)("takes every press on $key's drawn button as $key", ({ art, key }) => {
    const corners = [
      { x: art.x, y: art.y },
      { x: art.x + art.width - 1, y: art.y + art.height - 1 },
    ];
    expect(corners.map((point) => pressedArea(areas, point))).toEqual([key, key]);
  });
});

describe("celebration geometry", () => {
  it("draws Continue at ui-resume's size, and the stretched buttons no smaller than ui-button", () => {
    const resume = frameOf(resumeSheet);
    const button = frameOf(buttonSheet);
    const stretched = [CELEBRATION.restart.button];
    expect({
      continue: {
        height: CELEBRATION.continue.button.height,
        width: CELEBRATION.continue.button.width,
      },
      large: stretched.every((rect) => rect.width >= button.width && rect.height >= button.height),
    }).toEqual({ continue: resume, large: true });
  });
});
