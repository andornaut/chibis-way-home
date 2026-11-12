import { CARD_CONTENT } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { labelledButton } from "./labelledButton.ts";
import { MAP_SCREEN } from "./mapScreen.ts";

const footer = MAP_SCREEN.continue.button;

export const CUTSCENE_CONTINUE = labelledButton({
  ...footer,
  x: SCREEN.width - CARD_CONTENT.padding - footer.width,
  y: SCREEN.height - CARD_CONTENT.padding - footer.height,
});

export const STAGE_SUMMARY_BOUNDS = {
  height: CUTSCENE_CONTINUE.hit.y - CARD_CONTENT.gap - CARD_CONTENT.padding,
  width: SCREEN.width - 2 * CARD_CONTENT.padding,
  x: CARD_CONTENT.padding,
  y: CARD_CONTENT.padding,
};
