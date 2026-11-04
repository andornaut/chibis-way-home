import { SCREEN } from "../../data/screen";
import type { GameText } from "../../data/types";
import { TEXT_BUTTON } from "./buttonLabel";
import {
  CARD_CONTENT,
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
} from "./contentCard";

export function openingLayout(
  fonts: CardFonts,
  labels: Pick<GameText["dialogue"], "continue" | "skip">,
  text: string,
) {
  const footerHeight = TEXT_BUTTON.height + 2 * CARD_CONTENT.padding;
  const footerY = SCREEN.height - footerHeight;
  const words = [labels.skip, labels.continue];
  const size = cardActionsSize(fonts.title, "row", words);
  const group = {
    ...size,
    x: SCREEN.width - CARD_CONTENT.padding - size.width,
    y: footerY + (footerHeight - size.height) / 2,
  };
  const [skip, next] = cardActions(fonts.title, "row", group, words);
  const caption = cardTextSize(fonts.body, text);
  const captionWidth = group.x - (size.hitOutset ?? 0) - CARD_CONTENT.gap - CARD_CONTENT.padding;
  if (caption.width > captionWidth || caption.height > footerHeight) {
    throw new Error("Opening caption does not fit at the shared font size");
  }
  return {
    caption: {
      ...caption,
      x: CARD_CONTENT.padding,
      y: footerY + (footerHeight - caption.height) / 2,
    },
    continue: next!,
    footerY,
    skip: skip!,
  };
}
