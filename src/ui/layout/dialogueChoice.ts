import { CARD_CONTENT, DIALOGUE_CHOICE } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { dialogueLines } from "../dialogue/conversation";
import {
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { FONT_SCALE } from "./fontRoles";

export function dialogueChoiceLayout(
  fonts: CardFonts,
  prompt: string,
  options: readonly { readonly id: string; readonly label: string }[],
) {
  const text = dialogueLines(
    fonts.body,
    { lines: DIALOGUE_CHOICE.promptLines, scale: FONT_SCALE },
    SCREEN.width - 2 * CARD_CONTENT.padding,
    prompt,
  ).join("\n");
  const labels = options.map(({ label }) => label);
  const layout = contentCardLayout({ ...SCREEN, x: 0, y: 0 }, [
    { key: "question", ...cardTextSize(fonts.body, text) },
    { key: "actions", ...cardActionsSize(fonts.title, "stack", labels) },
  ]);
  const buttons = cardActions(fonts.title, "stack", layout.groups.actions!, labels);
  return {
    buttons: options.map(({ id }, index) => ({ id, layout: buttons[index]! })),
    card: layout.card,
    question: layout.groups.question!,
    text,
  };
}
