import { wrapWords } from "@andornaut/game-kit/lines";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN } from "../data/screen";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { CARD_CONTENT, type CardFonts, cardTextSize, contentCardLayout } from "./contentCard";
import { hitAround, hitMargin } from "./hitAreas";

export const STAGE_NUMBER_SCALE = 1.5;
const PREVIEW_WIDTH = 168;
const PREVIEW_HEIGHT = PREVIEW_WIDTH / 2;
const INSET = CARD_CONTENT.padding + CARD_CONTENT.rowGap;
const NUMBER_HEIGHT = (CARD_CONTENT.lineHeight * STAGE_NUMBER_SCALE) / CARD_TEXT_SCALE;
const PREVIEW_TOP =
  CARD_CONTENT.closeInset + NUMBER_HEIGHT + CARD_CONTENT.padding - CARD_CONTENT.rowGap;
const NAME_TOP = PREVIEW_TOP + PREVIEW_HEIGHT + CARD_CONTENT.rowGap;
const NAME_HEIGHT = 2 * CARD_CONTENT.lineHeight;
const STAGE_FACE = {
  height: NAME_TOP + NAME_HEIGHT + CARD_CONTENT.padding - CARD_CONTENT.rowGap,
  width: PREVIEW_WIDTH + 2 * INSET,
};

export function stageSelectCard(fonts: CardFonts, title: string, labels: readonly string[]) {
  if (labels.length === 0) {
    throw new Error("A stage picker requires at least one catalogue stage");
  }
  const layout = contentCardLayout(
    { ...SCREEN, x: 0, y: 0 },
    [
      {
        height: STAGE_FACE.height,
        hitOutset: hitMargin({ ...STAGE_FACE, x: 0, y: 0 }) + CARD_CONTENT.rowGap,
        key: "stages",
        width: labels.length * STAGE_FACE.width + (labels.length - 1) * CARD_CONTENT.padding,
      },
    ],
    { close: true, titleWidth: cardTextSize(fonts.title, title).width },
  );
  const group = layout.groups.stages!;
  return {
    buttons: labels.map((label, index) => {
      const lines = wrapWords(
        (line) => inkWidth(fonts.body, CARD_TEXT_SCALE, line),
        PREVIEW_WIDTH,
        label,
      );
      if (
        lines.length > 2 ||
        lines.some((line) => inkWidth(fonts.body, CARD_TEXT_SCALE, line) > PREVIEW_WIDTH)
      ) {
        throw new Error(`Stage label exceeds two lines: ${label}`);
      }
      const button = {
        ...STAGE_FACE,
        x: group.x + index * (STAGE_FACE.width + CARD_CONTENT.padding),
        y: group.y,
      };
      const textX = button.x + INSET;
      return {
        button,
        hit: hitAround(button),
        name: { height: NAME_HEIGHT, width: PREVIEW_WIDTH, x: textX, y: button.y + NAME_TOP },
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
    title: layout.title!,
  };
}
