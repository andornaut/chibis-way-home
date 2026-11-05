import { rectsOverlap } from "@andornaut/game-kit/rect";
import { buildLabel } from "@andornaut/game-kit/web/build/buildLabel";
import { expect, it } from "vitest";

import { ZONE_MAP } from "../../data/map";
import { SCREEN } from "../../data/screen";
import { TEXT } from "../../data/text";
import type { Rect } from "../../data/types";
import { ACHIEVEMENT_IDS } from "../../progress";
import { CARD_FONTS } from "../../testing/cardFonts";
import { achievementsCardLayout } from "./achievementsCard";
import { CARD_TEXT_SCALE } from "./cardFrame";
import {
  CARD_CONTENT,
  CARD_HEADING,
  cardActions,
  cardActionsSize,
  cardTextOrigin,
  cardTextSize,
  type CardTitleLayout,
  cardTitleOrigin,
  contentCardLayout,
} from "./contentCard";
import { FONT_METRICS } from "./fontRoles";
import { pressedArea } from "./hitAreas";
import { pauseCard } from "./pauseCard";
import { restartCard } from "./restartCard";
import { settingsCard, stepsCard } from "./settingsCard";
import { SKILL_ROOM, skillDetails } from "./skillDetails";
import { SKILL_BUTTON } from "./skillHud";
import { stageSelectPages } from "./stageSelectCard";
import { textInkBounds } from "./textInk";

const BUILD_LABEL = buildLabel(__APP_VERSION__, __COMMIT__);
const pause = pauseCard(CARD_FONTS, TEXT.pause);
const variants = [false, true].map((install) =>
  settingsCard(CARD_FONTS, TEXT.settings, BUILD_LABEL, install),
);
const installs = (["firefoxAndroid", "ios"] as const).map((browser) =>
  stepsCard(CARD_FONTS, TEXT.settings.installSteps.title, [
    TEXT.settings.installSteps[browser].first,
    TEXT.settings.installSteps[browser].second,
  ]),
);
const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const destination = ZONE_MAP.destinations[0]!;
const stageSelect = stageSelectPages(
  CARD_FONTS,
  undefined,
  TEXT.map.zones[destination.id]!,
  destination.stages.map((id) => TEXT.map.stages[id]!),
);
const updateActions = cardActionsSize(CARD_FONTS.title, "row", [TEXT.update.accept]);
const update = contentCardLayout(
  { ...SCREEN, x: 0, y: 0 },
  [{ key: "actions", ...updateActions }],
  { close: true, font: CARD_FONTS.title, title: TEXT.update.title },
);
const updateButton = cardActions(CARD_FONTS.title, "row", update.groups.actions!, [
  TEXT.update.accept,
])[0]!;

it.each([
  { first: pause.resume.hit, layout: pause },
  ...variants.map((layout) => ({ first: layout.moveControls.hit, layout })),
  ...installs.map((layout) => ({ first: layout.steps[0]!.text, layout })),
  { first: stageSelect.buttons[0]!.hit, layout: stageSelect },
  { first: updateButton.hit, layout: { ...update, close: update.close!, title: update.title! } },
])(
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
const titleInkBottom = (title: CardTitleLayout) => {
  const ink = textInkBounds(
    CARD_FONTS.title,
    CARD_HEADING.scale,
    CARD_HEADING.lineHeight,
    title.text,
  );
  return cardTitleOrigin(CARD_FONTS.title, title, title.text).y + ink.y + ink.height;
};
const textInkTop = (font: typeof CARD_FONTS.body, at: { readonly y: number }, text: string) =>
  at.y + textInkBounds(font, CARD_TEXT_SCALE, font.lineHeight * CARD_TEXT_SCALE, text).y;
const centredInkTop = (rect: Rect, text: string) =>
  textInkTop(CARD_FONTS.body, cardTextOrigin(CARD_FONTS.body, rect, text), text);
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
const achievementWords = ACHIEVEMENT_IDS.map((id) => TEXT.achievements.entries[id]);
const achievements = achievementsCardLayout(
  CARD_FONTS,
  { ...TEXT.achievements.pages, title: TEXT.achievements.cardTitle },
  achievementWords,
);
const restart = restartCard(CARD_FONTS, TEXT.restart);
const skills = (["dash", "doubleJump", "speedy"] as const).flatMap((skill) => [
  skillDetails(CARD_FONTS, { ...SCREEN, x: 0, y: 0 }, true, TEXT.buttons, TEXT.skills[skill]),
  skillDetails(CARD_FONTS, SKILL_ROOM.bounds, false, TEXT.buttons, TEXT.skills[skill]),
]);

it.each([
  {
    content: centredInkTop(variants[0]!.moveControls.label, TEXT.settings.moveControls),
    name: "settings",
    title: variants[0]!.title,
  },
  {
    content: Math.min(
      ...achievements.entries
        .slice(0, 2)
        .map(({ title }, index) =>
          textInkTop(CARD_FONTS.title, title, achievementWords[index]!.title),
        ),
    ),
    name: "achievements",
    title: achievements.title,
  },
  { content: pause.resume.button.y, name: "pause", title: pause.title },
  ...installs.map((layout, index) => ({
    content: centredInkTop(
      layout.steps[0]!.text,
      TEXT.settings.installSteps[index === 0 ? "firefoxAndroid" : "ios"].first,
    ),
    name: "install",
    title: layout.title,
  })),
  {
    content: centredInkTop(restart.question, TEXT.restart.question),
    name: "restart",
    title: restart.title,
  },
  { content: stageSelect.buttons[0]!.button.y, name: "stage selection", title: stageSelect.title },
  { content: updateButton.button.y, name: "update", title: update.title! },
  ...skills.map((layout) => ({
    content: skillInkTop(layout),
    name: "skill",
    title: layout.title!,
  })),
])(
  "keeps the shared visible gap from the $name title ink to its first content",
  ({ content, title }) => {
    const gap = content - titleInkBottom(title);
    // Whole-pixel group positions round the gap up by less than a pixel.
    expect(gap).toBeGreaterThanOrEqual(CARD_CONTENT.titleInkGap);
    expect(gap).toBeLessThan(CARD_CONTENT.titleInkGap + 1);
  },
);

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
  expect(pause.title.y - pause.card.y).toBe(CARD_CONTENT.padding);
  expect(
    pause.card.y + pause.card.height - actions.at(-1)!.art.y - actions.at(-1)!.art.height,
  ).toBe(CARD_CONTENT.padding);
  expect(pause.card.x + pause.card.width / 2).toBe(SCREEN.width / 2);
  expect(pause.card.y + pause.card.height / 2).toBe(SCREEN.height / 2);
  expect(pause.resume.hit.y).toBeGreaterThanOrEqual(
    pause.close.hit.y + pause.close.hit.height + CARD_CONTENT.gap,
  );
});

it.each([false, true])(
  "sizes settings with install=%s and keeps labels apart from controls",
  (hasInstall) => {
    const layout = settingsCard(CARD_FONTS, TEXT.settings, BUILD_LABEL, hasInstall);
    for (const key of ["moveControls", "actionButtons"] as const) {
      const row = layout[key];
      expect(row.label.x + row.label.width + CARD_CONTENT.gap).toBeLessThanOrEqual(row.toggle.x);
      expect(inside(layout.card, row.row)).toBe(true);
    }
    // Rows are their own 48px targets: the first starts a gap below the taller of the
    // main-heading line and the close target's clearance (42 + 8).
    const rows = [
      layout.moveControls,
      layout.actionButtons,
      ...(hasInstall ? [layout.install] : []),
    ];
    const closeClearance = layout.close.hit.y + layout.close.hit.height + CARD_CONTENT.gap;
    expect(layout.title.y - layout.card.y).toBe(CARD_CONTENT.padding);
    expect(layout.title.height).toBe(FONT_METRICS.mainHeading.lineHeight);
    expect(rows[0]!.row.y).toBe(
      Math.max(layout.title.y + layout.title.height + CARD_CONTENT.gap, closeClearance),
    );
    expect(rows[0]!.row.y).toBeGreaterThanOrEqual(closeClearance);
    rows.forEach(({ hit, row }, index) => {
      expect(hit).toEqual(row);
      expect(row.height).toBe(48);
      if (index > 0) {
        const above = rows[index - 1]!.row;
        expect(row.y - above.y - above.height).toBe(CARD_CONTENT.rowGap);
      }
    });
    const last = rows.at(-1)!.row;
    expect(layout.buildLabel.y - last.y - last.height).toBe(CARD_CONTENT.gap);
    expect(layout.buildLabel.y + layout.buildLabel.height + CARD_CONTENT.padding).toBe(
      layout.card.y + layout.card.height,
    );
  },
);

it("grows a measured card for longer labels without changing font scale or button height", () => {
  const longer = pauseCard(CARD_FONTS, { ...TEXT.pause, home: TEXT.pause.home.repeat(4) });
  expect(longer.card.width).toBeGreaterThan(pause.card.width);
  expect(longer.home.button.height).toBe(pause.home.button.height);
});
