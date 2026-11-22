import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { hitMargin } from "./hitAreas.ts";

const { height } = TEXT_BUTTON;
const hit = hitMargin({ height, width: height, x: 0, y: 0 });

export const CUTSCENE_CONTINUE = {
  hit,
  y: SCREEN.height - CARD_CONTENT.padding - height - hit,
} as const;
