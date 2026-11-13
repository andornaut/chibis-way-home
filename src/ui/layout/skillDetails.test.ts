import { rectsOverlap } from "@andornaut/game-kit/rect";
import { HIT_RULE } from "@andornaut/game-kit/ui/hitAreas";
import { SMALL_BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";
import { renderFit } from "@andornaut/game-kit/view/renderScale";
import { describe, expect, it } from "vitest";

import { CARD_CONTENT, CONTROL_FRAME_INSET, HUD_EDGE, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";
import { shifted, viewShift } from "./playView.ts";
import { ROOM_SCREEN } from "./roomScreen.ts";
import { SKILL_ROOM } from "./skillDetails.ts";
import { SKILL_BUTTON, skillButton, skillHud } from "./skillHud.ts";

const inside = (
  outer: { x: number; y: number; width: number; height: number },
  inner: typeof outer,
) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("native skill presentation", () => {
  it("keeps the gift footer's face anchor and its panel clear of the press area", () => {
    const footer = SKILL_ROOM.footer;
    expect(footer.height).toBe(TEXT_BUTTON.height);
    expect(SCREEN.width - footer.x - footer.width).toBe(CARD_CONTENT.padding);
    expect(SCREEN.height - footer.y - footer.height).toBe(CARD_CONTENT.padding);
    expect(SKILL_ROOM.bounds.y + SKILL_ROOM.bounds.height).toBeLessThan(footer.y);
    expect(ROOM_SCREEN.leave.art).toEqual({ height: 28, width: 72, x: 640, y: 10 });
  });
  it.each([
    { shown: ["doubleJump"] },
    { shown: ["speedy", "dash"] },
    { shown: ["dash", "doubleJump"] },
    { shown: [...SKILL_IDS] },
  ] satisfies { shown: SkillId[] }[])(
    "packs $shown into one top row with its discs HUD_EDGE in from the view's top and right, clear of Pause",
    ({ shown }) => {
      [SCREEN, { height: SCREEN.height + 120, width: SCREEN.width + 300 }].forEach((css) => {
        const shift = viewShift(renderFit(SCREEN, 1, css));
        const view = { ...SCREEN, ...shift };
        const row = skillHud(shown);
        expect([...row.keys()]).toEqual(SKILL_IDS.filter((skill) => shown.includes(skill)));
        const buttons = [...row.values()].map((at) => skillButton(shifted(shift, at)));
        const pause = { ...PAUSE_BUTTON.hit, ...shifted(shift, PAUSE_BUTTON.hit) };
        buttons.forEach(({ disc, hit }, index) => {
          expect(inside(view, hit)).toBe(true);
          expect(disc.y - view.y).toBeCloseTo(HUD_EDGE, 9);
          // The target stays centred on its disc.
          expect(disc.x - hit.x).toBeCloseTo(hit.x + hit.width - disc.x - SKILL_BUTTON.disc, 9);
          expect(disc.y - hit.y).toBeCloseTo(hit.y + hit.height - disc.y - SKILL_BUTTON.disc, 9);
          expect(hit.width).toBeGreaterThanOrEqual(HIT_RULE.minTarget);
          expect(hit.height).toBeGreaterThanOrEqual(HIT_RULE.minTarget);
          expect(rectsOverlap(hit, pause)).toBe(false);
          const next = buttons[index + 1];
          if (next) {
            expect(next.disc.x - disc.x - SKILL_BUTTON.disc).toBeCloseTo(SMALL_BUTTON_GAP, 9);
          }
        });
        const last = buttons.at(-1)!.disc;
        expect(view.x + view.width - (last.x + SKILL_BUTTON.disc)).toBeCloseTo(HUD_EDGE, 9);
      });
    },
  );
  it.each(SKILL_IDS.map((_, index) => index + 1))(
    "mirrors Pause's disc in the rightmost disc about the view's centre line with %i shown",
    (count) => {
      const shown = SKILL_IDS.slice(-count);
      const pause = {
        x: PAUSE_BUTTON.art.x + CONTROL_FRAME_INSET,
        y: PAUSE_BUTTON.art.y + CONTROL_FRAME_INSET,
      };
      const last = skillButton([...skillHud(shown).values()].at(-1)!).disc;
      expect(PAUSE_BUTTON.art.width - 2 * CONTROL_FRAME_INSET).toBe(SKILL_BUTTON.disc);
      expect({ x: SCREEN.width - pause.x - SKILL_BUTTON.disc, y: pause.y }).toEqual(last);
    },
  );
  it("places all three targets at art's origins in the base view", () => {
    expect([...skillHud(SKILL_IDS).values()]).toEqual([
      { x: 553.5, y: 4.5 },
      { x: 610.5, y: 4.5 },
      { x: 667.5, y: 4.5 },
    ]);
  });
  it("gives hidden skills no slot", () => {
    expect(skillHud([]).size).toBe(0);
    expect(skillHud(["dash"]).has("speedy")).toBe(false);
    expect(SKILL_BUTTON.target).toBeGreaterThanOrEqual(SKILL_BUTTON.disc);
    expect(SKILL_BUTTON.disc).toBeGreaterThan(SKILL_BUTTON.glyph);
  });
});
