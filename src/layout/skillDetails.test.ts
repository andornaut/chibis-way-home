import { rectsOverlap } from "@andornaut/game-kit/rect";
import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { SKILL_IDS } from "../rules/skills";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_CONTENT, cardTextSize } from "./contentCard";
import { HIT_RULE } from "./hitAreas";
import { PAUSE_BUTTON } from "./pauseCard";
import { CONTROL_EDGE, playView, shifted, topShift } from "./playView";
import { ROOM_SCREEN } from "./roomScreen";
import { SKILL_ROOM, skillDetails, skillRoomContinue } from "./skillDetails";
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
  it("measures the gift Continue footer at the shared native action size while ordinary rooms stay compact", () => {
    const action = skillRoomContinue(fonts, TEXT.dialogue.continue);
    expect(action.art.height).toBe(TEXT_BUTTON.height);
    expect(action.art.width).toBe(
      cardTextSize(fonts.title, TEXT.dialogue.continue).width + 2 * TEXT_BUTTON.inset,
    );
    expect(SCREEN.width - action.art.x - action.art.width).toBe(CARD_CONTENT.padding);
    expect(SCREEN.height - action.art.y - action.art.height).toBe(CARD_CONTENT.padding);
    expect(ROOM_SCREEN.leave.art).toEqual({ height: 28, width: 72, x: 640, y: 10 });
  });
  it.each(SKILL_IDS)(
    "fits full-font %s descriptions in a nonmodal room and centred modal",
    (skill) => {
      const room = skillDetails(fonts, SKILL_ROOM.bounds, false, TEXT.buttons, TEXT.skills[skill]);
      expect(room.close).toBeUndefined();
      expect(inside(SKILL_ROOM.bounds, room.card)).toBe(true);
      const action = skillRoomContinue(fonts, TEXT.dialogue.continue);
      expect(rectsOverlap(room.card, action.hit)).toBe(false);
      expect(inside({ ...SCREEN, x: 0, y: 0 }, action.hit)).toBe(true);
      const modal = skillDetails(
        fonts,
        { ...SCREEN, x: 0, y: 0 },
        true,
        TEXT.buttons,
        TEXT.skills[skill],
      );
      expect(modal.card.x + modal.card.width / 2).toBe(SCREEN.width / 2);
      expect(modal.card.y + modal.card.height / 2).toBe(SCREEN.height / 2);
      expect(modal.close?.hit.width).toBeGreaterThanOrEqual(48);
      expect(inside(modal.card, modal.groups.description!)).toBe(true);
    },
  );
  it("keeps one top row of native skill targets right-aligned, disjoint and clear of Pause", () => {
    const canvas = {
      height: SCREEN.height + SKILL_BUTTON.target,
      width: SCREEN.width + SKILL_BUTTON.target,
    };
    const view = playView(canvas);
    const shift = topShift(canvas);
    const hits = SKILL_IDS.map((skill) => skillButton(shifted(shift, SKILL_HUD[skill])).hit);
    const pause = { ...PAUSE_BUTTON.hit, ...shifted(shift, PAUSE_BUTTON.hit) };
    hits.forEach((hit, index) => {
      expect(inside(view, hit)).toBe(true);
      expect(hit.y).toBe(view.y + CONTROL_EDGE);
      expect(hit.width).toBeGreaterThanOrEqual(HIT_RULE.minTarget);
      expect(hit.height).toBeGreaterThanOrEqual(HIT_RULE.minTarget);
      expect(rectsOverlap(hit, pause)).toBe(false);
      hits.slice(index + 1).forEach((other) => expect(rectsOverlap(hit, other)).toBe(false));
      const next = hits[index + 1];
      if (next) {
        expect(next.x - hit.x - hit.width).toBe(CONTROL_EDGE);
      }
    });
    const last = hits.at(-1)!;
    expect(last.x + last.width).toBe(view.x + view.width - CONTROL_EDGE);
    expect(SKILL_BUTTON.target).toBeGreaterThanOrEqual(SKILL_BUTTON.disc);
    expect(SKILL_BUTTON.disc).toBeGreaterThan(SKILL_BUTTON.glyph);
  });
});
