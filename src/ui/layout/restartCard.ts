import { CELEBRATION_LAYOUT } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { GameText, Point } from "../../data/types";
import { CARD_FRAME, cardRect } from "./cardFrame";
import {
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { labelledButton } from "./labelledButton";
export { type LabelledButton, labelledButton } from "./labelledButton";

export function restartCard(fonts: CardFonts, words: GameText["restart"]) {
  const labels = [words.cancel, words.restart];
  const layout = contentCardLayout(
    { ...SCREEN, x: 0, y: 0 },
    [
      { key: "question", ...cardTextSize(fonts.body, words.question) },
      { key: "actions", ...cardActionsSize(fonts.title, "row", labels) },
    ],
    { close: false, font: fonts.title, title: words.title },
  );
  const [cancel, restart] = cardActions(fonts.title, "row", layout.groups.actions!, labels);
  return {
    cancel: cancel!,
    card: layout.card,
    question: layout.groups.question!,
    restart: restart!,
    room: layout.groups.question!.width,
    title: layout.title!,
  };
}

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
