import { SCREEN } from "../data/screen";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_CONTENT } from "./cardFrame";
import { labelledButton } from "./labelledButton";
import { MAP_SCREEN } from "./mapScreen";

const footer = MAP_SCREEN.continue.button;

export const CUTSCENE_CONTINUE = labelledButton(
  { ...footer, x: SCREEN.width - CARD_CONTENT.padding - footer.width },
  TEXT_BUTTON.labelDy,
);
