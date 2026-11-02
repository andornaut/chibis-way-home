import { rectsOverlap } from "@andornaut/game-kit/rect";
import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { SKILL_IDS } from "../rules/skills";
import { SKILL_ROOM, skillDetails } from "./skillDetails";
import { SKILL_BUTTON, SKILL_HUD, skillButton } from "./skillHud";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
const inside = (
  outer: { x: number; y: number; width: number; height: number },
  inner: typeof outer,
) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("native skill presentation", () => {
  it.each(SKILL_IDS)(
    "fits full-font %s descriptions in a nonmodal room and centred modal",
    (skill) => {
      const room = skillDetails(fonts, SKILL_ROOM.bounds, false, TEXT.skills[skill]);
      expect(room.close).toBeUndefined();
      expect(inside(SKILL_ROOM.bounds, room.card)).toBe(true);
      expect(rectsOverlap(room.card, SKILL_ROOM.leave.hit)).toBe(false);
      const modal = skillDetails(fonts, { ...SCREEN, x: 0, y: 0 }, true, TEXT.skills[skill]);
      expect(modal.card.x + modal.card.width / 2).toBe(SCREEN.width / 2);
      expect(modal.card.y + modal.card.height / 2).toBe(SCREEN.height / 2);
      expect(modal.close?.hit.width).toBeGreaterThanOrEqual(48);
      expect(inside(modal.card, modal.groups.description!)).toBe(true);
    },
  );
  it("keeps the compact L targets disjoint inside the view without scaling their native art", () => {
    const hits = SKILL_IDS.map((skill) => skillButton(SKILL_HUD[skill]).hit);
    hits.forEach((hit, index) => {
      expect(inside({ ...SCREEN, x: 0, y: 0 }, hit)).toBe(true);
      hits.slice(index + 1).forEach((other) => expect(rectsOverlap(hit, other)).toBe(false));
    });
    expect(SKILL_BUTTON.target).toBeGreaterThanOrEqual(SKILL_BUTTON.disc);
    expect(SKILL_BUTTON.disc).toBeGreaterThan(SKILL_BUTTON.glyph);
  });
});
