import { rectsOverlap } from "@andornaut/game-kit/rect";
import { expect, it } from "vitest";

import manifest from "../../../public/art/manifest.json";
import { CARD_CONTENT } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { TEXT } from "../../data/text";
import type { Rect } from "../../data/types";
import { CARD_FONTS } from "../../testing/cardFonts";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { CARD_HEADING, cardTextSize, type CardTitleLayout, cardTitleOrigin } from "./contentCard";
import { pressedArea } from "./hitAreas";
import { pauseCard } from "./pauseCard";
import { SKILL_ROOM, skillDetails } from "./skillDetails";
import { SKILL_BUTTON } from "./skillHud";
import { textInkBounds } from "./textInk";

const pause = pauseCard(CARD_FONTS, TEXT.pause);
const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

it.each([{ first: pause.resume.hit, layout: pause }])(
  "keeps close targets clear of centred titles and body controls within the viewport",
  ({ first, layout: { card, close, title } }) => {
    expect(inside({ ...SCREEN, x: 0, y: 0 }, card)).toBe(true);
    expect(inside(card, close.art)).toBe(true);
    expect(card.x + card.width - close.art.x - close.art.width).toBe(CARD_CONTENT.closeInset);
    expect(close.art.y - card.y).toBe(CARD_CONTENT.closeInset);
    expect(title.x + title.width / 2).toBe(card.x + card.width / 2);
    expect(title.width).toBeGreaterThan(0);
    expect(title.x + title.width + CARD_CONTENT.gap).toBeLessThanOrEqual(close.hit.x);
    expect(first.y).toBeGreaterThanOrEqual(close.hit.y + close.hit.height + CARD_CONTENT.gap);
  },
);

// Visible ink tops and bottoms, measured as the scenes draw them.
const titleInk = (title: CardTitleLayout) => {
  const ink = textInkBounds(
    CARD_FONTS.title,
    CARD_HEADING.scale,
    CARD_HEADING.lineHeight,
    title.text,
  );
  const top = cardTitleOrigin(CARD_FONTS.title, title, title.text).y + ink.y;
  return { bottom: top + ink.height, top };
};
const textInkTop = (font: typeof CARD_FONTS.body, at: { readonly y: number }, text: string) =>
  at.y + textInkBounds(font, CARD_TEXT_SCALE, font.lineHeight * CARD_TEXT_SCALE, text).y;
const skillInkTop = (layout: ReturnType<typeof skillDetails>) => {
  const { description, icon } = layout.groups;
  return Math.min(
    icon.y + (SKILL_BUTTON.target - SKILL_BUTTON.disc) / 2,
    ...layout.description.placements.map((placement) =>
      placement.kind === "icon"
        ? description.y + placement.rect.y
        : textInkTop(
            CARD_FONTS[placement.font],
            { y: description.y + placement.at.y },
            placement.text,
          ),
    ),
  );
};
const skills = (["dash", "doubleJump", "speedy"] as const).map((skill) =>
  skillDetails(CARD_FONTS, SKILL_ROOM.bounds, TEXT.buttons, TEXT.skills[skill]),
);

it.each([
  { content: pause.resume.button.y, layout: pause, name: "pause" },
  ...skills.map((layout) => ({
    content: skillInkTop(layout),
    layout: { ...layout, title: layout.title! },
    name: "skill",
  })),
])(
  "balances the $name title: frame to title ink equals title ink to first content",
  ({ content, layout: { card, title } }) => {
    const ink = titleInk(title);
    const above = ink.top - (card.y + CARD_CONTENT.frameBorder);
    const below = content - ink.bottom;
    expect(Math.abs(below - above)).toBeLessThanOrEqual(1);
    expect(title.y - card.y).toBeGreaterThanOrEqual(CARD_CONTENT.padding);
  },
);

it("measures title balance inside the card frame's 9-slice top edge", () => {
  const frame = manifest.sprites.find(({ key }) => key === "ui-settings-card");
  expect(frame?.slice?.top).toBe(CARD_CONTENT.frameBorder);
});

it("fills pause actions with equal panel insets and preserves distinct hit selection", () => {
  const actions = (["resume", "settings", "home"] as const).map((key) => ({
    art: pause[key].button,
    hit: pause[key].hit,
    key,
  }));
  const widest = Math.max(
    ...[TEXT.pause.resume, TEXT.pause.settings, TEXT.pause.home].map(
      (text) => cardTextSize(CARD_FONTS.title, text).width,
    ),
  );
  for (const action of actions) {
    expect(action.art.width).toBe(pause.card.width - 2 * CARD_CONTENT.padding);
    expect(action.art.width).toBeGreaterThanOrEqual(widest + 32);
    expect(action.art.x - pause.card.x).toBe(CARD_CONTENT.padding);
    expect(pause.card.x + pause.card.width - action.art.x - action.art.width).toBe(
      CARD_CONTENT.padding,
    );
    expect(
      pressedArea(actions, {
        x: action.art.x + action.art.width / 2,
        y: action.art.y + action.art.height / 2,
      }),
    ).toBe(action.key);
  }
  expect(rectsOverlap(actions[0]!.art, actions[1]!.art)).toBe(false);
  for (let index = 1; index < actions.length; index++) {
    expect(actions[index]!.art.y - actions[index - 1]!.art.y - actions[index - 1]!.art.height).toBe(
      CARD_CONTENT.gap,
    );
  }
  expect(pause.title.y - pause.card.y).toBeGreaterThanOrEqual(CARD_CONTENT.padding);
  expect(
    pause.card.y + pause.card.height - actions.at(-1)!.art.y - actions.at(-1)!.art.height,
  ).toBe(CARD_CONTENT.padding);
  expect(pause.card.x + pause.card.width / 2).toBe(SCREEN.width / 2);
  expect(pause.card.y + pause.card.height / 2).toBe(SCREEN.height / 2);
  expect(pause.resume.hit.y).toBeGreaterThanOrEqual(
    pause.close.hit.y + pause.close.hit.height + CARD_CONTENT.gap,
  );
});

it("grows a measured card for longer labels without changing font scale or button height", () => {
  const longer = pauseCard(CARD_FONTS, { ...TEXT.pause, home: TEXT.pause.home.repeat(4) });
  expect(longer.card.width).toBeGreaterThan(pause.card.width);
  expect(longer.home.button.height).toBe(pause.home.button.height);
});
