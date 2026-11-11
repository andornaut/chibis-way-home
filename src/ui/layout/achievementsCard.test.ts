import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS_CARD, CARD_CONTENT } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { TEXT } from "../../data/text";
import type { Rect } from "../../data/types";
import { ACHIEVEMENT_IDS } from "../../progress";
import { CARD_FONTS } from "../../testing/cardFonts";
import { dialogueLines } from "../dialogue/conversation";
import { achievementsCardLayout, achievementsPerPage } from "./achievementsCard";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { DIALOGUE_SCREEN } from "./dialogueScreen";
import { FONT_METRICS } from "./fontRoles";
import { type PressArea, pressedArea } from "./hitAreas";

const WORDS = { ...TEXT.achievements.pages, title: TEXT.achievements.cardTitle };
const ENTRIES = ACHIEVEMENT_IDS.map((id) => ({
  ...TEXT.achievements.entries[id],
  ...(id.startsWith("no-death-") && { progress: "5/6" }),
}));
const LAYOUT = achievementsCardLayout(CARD_FONTS, WORDS, ENTRIES);
const right = (rect: Rect) => rect.x + rect.width;
const bottom = (rect: Rect) => rect.y + rect.height;
const within = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  right(inner) <= right(outer) &&
  bottom(inner) <= bottom(outer);
const overlap = (a: Rect, b: Rect) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);

describe("the Achievements card", () => {
  it("pages all 26 entries, six to a page, in full pages before the last", () => {
    const perPage = achievementsPerPage(CARD_FONTS, WORDS, ENTRIES);
    const pages = LAYOUT.entries.map((_, index) => Math.floor(index / perPage));
    expect({ lastPage: pages.at(-1), pages: LAYOUT.pages, perPage }).toEqual({
      lastPage: 4,
      pages: 5,
      perPage: 6,
    });
  });

  it("keeps one page's slots apart, inside the card and above the pager", () => {
    const slots = LAYOUT.entries.slice(0, LAYOUT.perPage).map(({ slot }) => slot);
    const { next, previous } = LAYOUT.pager;
    expect({
      abovePager: slots.every((slot) => bottom(slot) < previous.button.y),
      apart: slots.every((a, i) => slots.every((b, j) => i === j || !overlap(a, b))),
      inside: slots.every((slot) => within(LAYOUT.card, slot)),
      pagerInside: [next.button, previous.button].every((button) => within(LAYOUT.card, button)),
      sameSlotsEachPage: LAYOUT.entries.every(({ slot }, index) =>
        Object.is(JSON.stringify(slot), JSON.stringify(slots[index % LAYOUT.perPage])),
      ),
      underTitle: slots.every((slot) => slot.y > bottom(LAYOUT.title)),
    }).toEqual({
      abovePager: true,
      apart: true,
      inside: true,
      pagerInside: true,
      sameSlotsEachPage: true,
      underTitle: true,
    });
  });

  it("sets the title at the main heading and keeps the list below it and the close target", () => {
    const first = LAYOUT.entries[0]!.slot;
    expect(LAYOUT.title.height).toBe(FONT_METRICS.mainHeading.lineHeight);
    expect(first.y).toBeGreaterThanOrEqual(bottom(LAYOUT.title) + CARD_CONTENT.gap);
    expect(first.y).toBeGreaterThanOrEqual(bottom(LAYOUT.close.hit) + CARD_CONTENT.gap);
  });

  it("fits the card in the view, centred, with Previous left and Next right of the count", () => {
    const { card, pager } = LAYOUT;
    expect({
      centred: [card.x * 2 + card.width, card.y * 2 + card.height],
      countBetween:
        right(pager.previous.button) < pager.count.x && right(pager.count) < pager.next.button.x,
      onScreen: within({ ...SCREEN, x: 0, y: 0 }, card),
    }).toEqual({ centred: [SCREEN.width, SCREEN.height], countBetween: true, onScreen: true });
  });

  it("takes every press on a drawn pager button or the close X as that control", () => {
    const { close, pager } = LAYOUT;
    const areas: PressArea<string>[] = [
      { art: close.art, hit: close.hit, key: "close" },
      { art: pager.next.button, hit: pager.next.hit, key: "next" },
      { art: pager.previous.button, hit: pager.previous.hit, key: "previous" },
    ];
    expect(
      areas.map(({ art }) => [
        pressedArea(areas, { x: art.x, y: art.y }),
        pressedArea(areas, { x: right(art) - 1, y: bottom(art) - 1 }),
      ]),
    ).toEqual(areas.map(({ key }) => [key, key]));
  });

  it("fits every title beside its count and every description in two lines of its slot", () => {
    for (const [index, entry] of LAYOUT.entries.entries()) {
      const { slot, title } = entry;
      const textRight = right(slot);
      const titleRight =
        title.x + inkWidth(CARD_FONTS.title, CARD_TEXT_SCALE, ENTRIES[index]!.title);
      expect(titleRight, ENTRIES[index]!.title).toBeLessThanOrEqual(entry.progress?.x ?? textRight);
      expect(entry.description.length).toBeLessThanOrEqual(2);
      for (const line of entry.description) {
        expect(
          line.at.x + inkWidth(CARD_FONTS.body, CARD_TEXT_SCALE, line.text),
        ).toBeLessThanOrEqual(textRight);
        expect(line.at.y + CARD_FONTS.body.lineHeight).toBeLessThanOrEqual(bottom(slot));
      }
      expect(entry.icon.x + ACHIEVEMENTS_CARD.icon).toBeLessThan(title.x);
    }
  });

  it("refuses a description that needs a third line", () => {
    const long = { description: `${ENTRIES[0]!.description} `.repeat(6), title: "Long" };
    expect(() => achievementsCardLayout(CARD_FONTS, WORDS, [long])).toThrow(/2 lines/);
  });

  it("fits every unlock notice's bold line and description in the dialogue panel's text", () => {
    const text = DIALOGUE_SCREEN.text;
    for (const id of ACHIEVEMENT_IDS) {
      const { description, title } = TEXT.achievements.entries[id];
      const heading = TEXT.achievements.notice.replace("{title}", title);
      expect(inkWidth(CARD_FONTS.title, text.scale, heading), id).toBeLessThanOrEqual(text.width);
      expect(
        dialogueLines(CARD_FONTS.body, { ...text, lines: text.lines - 1 }, text.width, description),
        id,
      ).not.toHaveLength(0);
    }
  });
});
