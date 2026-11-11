import type { LayoutValues } from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { slice } from "@andornaut/game-kit/web/ui/dom/viewUnits";

import { CARD_CONTENT, STAGE_PREVIEW, STAGE_SELECT } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { cardHeaderLayout } from "./contentCard";
import { FONT_METRICS } from "./fontRoles";
import { hitMargin } from "./hitAreas";

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
const FACE = {
  height: NAME_TOP + NAME_HEIGHT + CARD_CONTENT.padding - CARD_CONTENT.rowGap,
  width: STAGE_PREVIEW.width + 2 * INSET,
};
const FACE_HIT = hitMargin({ ...FACE, x: 0, y: 0 });
// The title, on one line at the main-heading size, and the stages' tops below the card's top.
const HEADER = cardHeaderLayout(
  true,
  { hitOutset: FACE_HIT, inkTop: 0 },
  { height: FONT_METRICS.mainHeading.lineHeight, text: "", width: 0 },
);

export const STAGES_PER_PAGE = Math.max(
  1,
  Math.floor((SCREEN.width - 3 * CARD_CONTENT.padding) / (FACE.width + CARD_CONTENT.padding)),
);

export function stagePageOf(stages: readonly string[], stage: string): number {
  return Math.floor(Math.max(0, stages.indexOf(stage)) / STAGES_PER_PAGE);
}

// The constants stageSelect.css reads, as unitless base px or whole CSS px lengths.
export const STAGE_SELECT_LAYOUT: LayoutValues = {
  "--stage-body-top": HEADER.bodyTop,
  "--stage-face-height": FACE.height,
  "--stage-face-hit": FACE_HIT,
  "--stage-face-width": FACE.width,
  "--stage-gap": CARD_CONTENT.padding,
  "--stage-inset": INSET,
  "--stage-name-height": NAME_HEIGHT,
  "--stage-name-top": NAME_TOP,
  "--stage-number-height": NUMBER_HEIGHT,
  "--stage-number-top": NUMBER_TOP,
  "--stage-preview-height": STAGE_PREVIEW.height,
  "--stage-preview-top": PREVIEW_TOP,
  "--stage-preview-width": STAGE_PREVIEW.width,
  "--stage-sink": slice(STAGE_SELECT.pressedSink),
  "--stage-title-top": HEADER.titleTop,
};
