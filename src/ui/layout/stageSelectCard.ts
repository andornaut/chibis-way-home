import { wrapWords } from "@andornaut/game-kit/lines";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";

import { CARD_CONTENT, STAGE_PREVIEW, STAGE_SELECT } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { cardActionsSize, type CardFonts, cardTextSize, contentCardLayout } from "./contentCard";
import { FONT_SCALE } from "./fontRoles";
import { hitAround, hitMargin } from "./hitAreas";
import { labelledButton } from "./labelledButton";

export const STAGE_NUMBER_SCALE = FONT_SCALE;
const PREVIEW_WIDTH = STAGE_PREVIEW.width;
const PREVIEW_HEIGHT = STAGE_PREVIEW.height;
const INSET = CARD_CONTENT.padding + CARD_CONTENT.rowGap;
const NUMBER_HEIGHT = (CARD_CONTENT.lineHeight * STAGE_NUMBER_SCALE) / CARD_TEXT_SCALE;
const PREVIEW_TOP = CARD_CONTENT.closeInset + NUMBER_HEIGHT + CARD_CONTENT.rowGap;
const NAME_TOP = PREVIEW_TOP + PREVIEW_HEIGHT + CARD_CONTENT.rowGap;
const STAGE_FACE_WIDTH = PREVIEW_WIDTH + 2 * INSET;

export const STAGES_PER_PAGE = Math.max(
  1,
  Math.floor((SCREEN.width - 3 * CARD_CONTENT.padding) / (STAGE_FACE_WIDTH + CARD_CONTENT.padding)),
);
interface StagePageLabels {
  readonly next: string;
  readonly page: string;
  readonly previous: string;
}

export function stagePageOf(stages: readonly string[], stage: string): number {
  return Math.floor(Math.max(0, stages.indexOf(stage)) / STAGES_PER_PAGE);
}

export function stageSelectPages(
  fonts: CardFonts,
  pagerLabels: StagePageLabels | undefined,
  title: string,
  labels: readonly string[],
) {
  if (labels.length === 0) {
    throw new Error("A stage picker requires at least one catalogue stage");
  }
  const pages = Math.ceil(labels.length / STAGES_PER_PAGE);
  if (pages > 1 && !pagerLabels) {
    throw new Error("A paged stage picker requires pager labels");
  }
  const nameHeight = fonts.title.lineHeight * CARD_TEXT_SCALE + CARD_CONTENT.lineHeight;
  const stageFace = {
    height: NAME_TOP + nameHeight + CARD_CONTENT.padding - CARD_CONTENT.rowGap,
    width: STAGE_FACE_WIDTH,
  };
  const visible = Math.min(labels.length, STAGES_PER_PAGE);
  const pagerSize =
    pagerLabels && pages > 1
      ? cardActionsSize(fonts.title, "row", [pagerLabels.previous, pagerLabels.next])
      : undefined;
  const countText =
    pagerLabels?.page.replace("{page}", String(pages)).replace("{pages}", String(pages)) ?? "";
  const countSize = cardTextSize(fonts.body, countText);
  const layout = contentCardLayout(
    { ...SCREEN, x: 0, y: 0 },
    [
      {
        height: stageFace.height,
        hitOutset: hitMargin({ ...stageFace, x: 0, y: 0 }),
        inkTop: 0,
        key: "stages",
        width: visible * stageFace.width + (visible - 1) * CARD_CONTENT.padding,
      },
      ...(pagerSize
        ? [
            {
              ...pagerSize,
              height:
                pagerSize.height +
                hitMargin({ ...stageFace, x: 0, y: 0 }) +
                2 * (pagerSize.hitOutset ?? 0),
              key: "pager",
              width:
                pagerSize.width +
                countSize.width +
                CARD_CONTENT.gap +
                2 * (pagerSize.hitOutset ?? 0),
            },
          ]
        : []),
    ],
    { close: true, font: fonts.title, title },
  );
  const group = layout.groups.stages!;
  const pagerGroup = layout.groups.pager;
  const pager = pagerGroup &&
    pagerSize && {
      ...pagerGroup,
      height: pagerSize.height,
      y: pagerGroup.y + hitMargin({ ...stageFace, x: 0, y: 0 }) + (pagerSize.hitOutset ?? 0),
    };
  const pagerWidth = pagerSize ? (pagerSize.width - CARD_CONTENT.gap) / 2 : 0;
  const pagerLayout = pager && {
    count: {
      ...countSize,
      x: pager.x + (pager.width - countSize.width) / 2,
      y: pager.y + (pager.height - countSize.height) / 2,
    },
    next: labelledButton({ ...pager, width: pagerWidth, x: pager.x + pager.width - pagerWidth }),
    previous: labelledButton({ ...pager, width: pagerWidth }),
  };
  return {
    buttons: labels.map((label, index) => {
      const lines = wrapWords(
        (line) => inkWidth(fonts.title, CARD_TEXT_SCALE, line),
        PREVIEW_WIDTH,
        label,
      );
      if (
        lines.length > STAGE_SELECT.labelLines ||
        lines.some((line) => inkWidth(fonts.title, CARD_TEXT_SCALE, line) > PREVIEW_WIDTH)
      ) {
        throw new Error(`Stage label exceeds two lines: ${label}`);
      }
      const button = {
        ...stageFace,
        x: group.x + (index % STAGES_PER_PAGE) * (stageFace.width + CARD_CONTENT.padding),
        y: group.y,
      };
      const textX = button.x + INSET;
      return {
        button,
        hit: hitAround(button),
        name: { height: nameHeight, width: PREVIEW_WIDTH, x: textX, y: button.y + NAME_TOP },
        number: {
          height: NUMBER_HEIGHT,
          width: PREVIEW_WIDTH,
          x: textX,
          y: button.y + CARD_CONTENT.closeInset,
        },
        preview: {
          height: PREVIEW_HEIGHT,
          width: PREVIEW_WIDTH,
          x: textX,
          y: button.y + PREVIEW_TOP,
        },
        text: lines.join("\n"),
      };
    }),
    card: layout.card,
    close: layout.close!,
    pager: pagerLayout,
    pages,
    title: layout.title!,
  };
}
