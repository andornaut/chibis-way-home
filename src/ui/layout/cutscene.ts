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
