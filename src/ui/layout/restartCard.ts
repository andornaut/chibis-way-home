import { CELEBRATION_LAYOUT } from "../../data/layout.ts";
import type { Point } from "../../data/types/index.ts";
import { CARD_FRAME, cardRect } from "./cardFrame.ts";
import { labelledButton } from "./labelledButton.ts";
export { type LabelledButton, labelledButton } from "./labelledButton.ts";

// PLACEHOLDER: the celebration screen after the last zone, until art draws one: the settings
// card's parts over ink, its title, the message in body text at most room wide, then Restart (art's
// `ui-button` stretched) and Continue (art's `ui-resume`, led by the play mark) side by side.
const celebrationButton = (x: number) =>
  labelledButton({
    ...CELEBRATION_LAYOUT.button,
    x,
    y: CARD_FRAME.firstRowY + CELEBRATION_LAYOUT.buttonsTop,
  });

export const CELEBRATION = {
  card: cardRect(CELEBRATION_LAYOUT.height),
  continue: celebrationButton(CELEBRATION_LAYOUT.continueX),
  message: {
    x: CELEBRATION_LAYOUT.message.x,
    y: CARD_FRAME.firstRowY + CELEBRATION_LAYOUT.message.top,
  } satisfies Point,
  restart: celebrationButton(CELEBRATION_LAYOUT.restartX),
  room: CELEBRATION_LAYOUT.room,
} as const;
