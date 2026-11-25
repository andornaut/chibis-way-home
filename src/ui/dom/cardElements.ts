import type { CardWidth } from "../layout/contentCard.ts";

// CLEANUP (added 2026-11-25): remove once every card is built with createCardFrame.
export { textButton as createTextButtonElement } from "./card.ts";
export { closeButton } from "./cardFrame.ts";

export function setCardWidth(family: CardWidth, card: HTMLElement): void {
  card.dataset.cardWidth = family;
}
