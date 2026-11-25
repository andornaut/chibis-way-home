import type { LayoutValues } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, STAGE_PREVIEW, STAGE_SELECT, TEXT_BUTTON } from "../../data/layout.ts";
import type { Size } from "../../data/types/index.ts";
import { type CardWidth, cardWidth } from "./contentCard.ts";
import { FONT_METRICS } from "./fontRoles.ts";
import { hitMargin } from "./hitAreas.ts";

// The stage picker's geometry (src/ui/dom/stageSelect.css), in base px. Each stage's face holds
// its number at the top right, its screenshot below and its name centred under that, all inset
// from the face's sides by the card padding plus a row gap.
const INSET = CARD_CONTENT.padding + CARD_CONTENT.rowGap;
const NUMBER_TOP = CARD_CONTENT.closeInset;
const NUMBER_HEIGHT = CARD_CONTENT.lineHeight;
const PREVIEW_TOP = NUMBER_TOP + NUMBER_HEIGHT + CARD_CONTENT.rowGap;
const NAME_TOP = PREVIEW_TOP + STAGE_PREVIEW.height + CARD_CONTENT.rowGap;
// A name's first line at the body line height, and room for each further line.
const NAME_HEIGHT =
  FONT_METRICS.body.lineHeight + (STAGE_SELECT.labelLines - 1) * CARD_CONTENT.lineHeight;

// A stage's face, a fixed size.
export const STAGE_FACE: Size = {
  height: NAME_TOP + NAME_HEIGHT + CARD_CONTENT.padding - CARD_CONTENT.rowGap,
  width: STAGE_PREVIEW.width + 2 * INSET,
};

// How far a face's and a text button's press areas reach past them.
const FACE_HIT = hitMargin({ ...STAGE_FACE, x: 0, y: 0 });
const BUTTON_HIT = hitMargin({
  height: TEXT_BUTTON.height,
  width: TEXT_BUTTON.height,
  x: 0,
  y: 0,
});

// The card takes the large width family; a page holds as many faces as fit inside its padding,
// the button gap apart.
export const STAGE_SELECT_WIDTH: CardWidth = "large";
export const STAGE_ROW_WIDTH = cardWidth(STAGE_SELECT_WIDTH) - 2 * CARD_CONTENT.padding;
export const STAGES_PER_PAGE = Math.max(
  1,
  Math.floor((STAGE_ROW_WIDTH + TEXT_BUTTON.gap) / (STAGE_FACE.width + TEXT_BUTTON.gap)),
);

// The faces' row below the card's header, which ends where a text button's press area would
// clear the close X's press target by the card gap: a face's press area reaches further, so the
// row starts lower by the difference.
export const STAGE_ROW_INSET = FACE_HIT - BUTTON_HIT;

export function stagePageOf(stages: readonly string[], stage: string): number {
  return Math.floor(Math.max(0, stages.indexOf(stage)) / STAGES_PER_PAGE);
}

// The constants stageSelect.css reads, as unitless base px.
export const STAGE_SELECT_LAYOUT: LayoutValues = {
  "--stage-face-height": STAGE_FACE.height,
  "--stage-face-width": STAGE_FACE.width,
  "--stage-inset": INSET,
  "--stage-name-height": NAME_HEIGHT,
  "--stage-name-top": NAME_TOP,
  "--stage-number-height": NUMBER_HEIGHT,
  "--stage-number-top": NUMBER_TOP,
  "--stage-preview-height": STAGE_PREVIEW.height,
  "--stage-preview-top": PREVIEW_TOP,
  "--stage-preview-width": STAGE_PREVIEW.width,
  "--stage-row-inset": STAGE_ROW_INSET,
  "--stage-row-width": STAGE_ROW_WIDTH,
};
