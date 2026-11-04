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
    { close: false, titleWidth: cardTextSize(fonts.title, words.title).width },
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
export const CELEBRATION = {
  card: cardRect(184),
  continue: labelledButton({ height: 44, width: 160, x: 368, y: CARD_FRAME.firstRowY + 72 }),
  message: { x: 198, y: CARD_FRAME.firstRowY + 4 } satisfies Point,
  restart: labelledButton({ height: 44, width: 160, x: 192, y: CARD_FRAME.firstRowY + 72 }),
  room: 324,
} as const;
