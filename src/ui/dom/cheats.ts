import { createFormRows } from "@andornaut/game-kit/runtime/web/ui/dom/formRow";

import { createGameFormRow } from "../input/actionBinding.ts";
import { SWITCH_ROWS } from "../layout/settingsCard.ts";
import { createActions } from "./actions.ts";
import { textButton } from "./card.ts";
import { createCardFrame } from "./cardFrame.ts";

// The cheats card in the HTML UI (cardFrame.ts, cheats.css): its title, the unlock actions as a
// full-width stack, the Invincibility switch row on the kit's form rows (role switch,
// aria-checked, named by its label and described by its note), a feedback line, Back in the
// footer and the close X. The card's press context clamps the stack's, the row's and Back's press
// areas toward each other. The keyboard's focus moves through the unlock actions, the switch row,
// Back and the close X.

export type CheatAction = "unlockAllPowerUps" | "unlockAllZones";

export interface CheatsCardWords {
  readonly back: string;
  readonly close: string;
  readonly invulnerable: string;
  readonly invulnerableNote: string;
  readonly state: { readonly off: string; readonly on: string };
  readonly title: string;
  readonly unlockAllPowerUps: string;
  readonly unlockAllZones: string;
}

export interface CheatsCardView {
  readonly actions: Readonly<Record<CheatAction, HTMLButtonElement>>;
  readonly back: HTMLButtonElement;
  readonly backdrop: HTMLElement;
  readonly closeX: HTMLButtonElement;
  readonly dialog: HTMLElement;
  readonly invincibility: HTMLButtonElement;
  readonly root: HTMLElement;
  // Shows the Invincibility switch on or off.
  showInvincibility(enabled: boolean): void;
  readonly status: HTMLElement;
}

export function createCheatsCard(
  document: Document,
  id: string,
  words: CheatsCardWords,
): CheatsCardView {
  const frame = createCardFrame(document, {
    className: "cheats-card",
    close: words.close,
    id,
    title: words.title,
    width: "medium",
  });
  const actions = {
    unlockAllPowerUps: textButton(document, words.unlockAllPowerUps),
    unlockAllZones: textButton(document, words.unlockAllZones),
  };
  const stack = createActions(document, [actions.unlockAllPowerUps, actions.unlockAllZones], {
    className: "ui-card-actions cheats-actions",
    context: { axis: "stack", stackWidth: "fill" },
  });
  let enabled = false;
  const rows = createFormRows(document, SWITCH_ROWS, { className: "switch-rows cheats-rows" });
  const invincibility = createGameFormRow(document, {
    className: "ui-button-reset",
    getState: () => ({ checked: enabled, value: words.state[enabled ? "on" : "off"] }),
    label: words.invulnerable,
    note: words.invulnerableNote,
    switch: true,
  });
  rows.element.append(invincibility.element);
  const status = document.createElement("p");
  status.className = "ui-card-text ui-text-body cheats-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  frame.content.append(stack.element, rows.element, status);
  const back = textButton(document, words.back, true);
  frame.setFooter([back]);
  frame.presses.add(stack.group);
  frame.presses.add(invincibility.element);
  return {
    actions,
    back,
    backdrop: frame.backdrop,
    closeX: frame.close!,
    dialog: frame.dialog,
    invincibility: invincibility.element,
    root: frame.root,
    showInvincibility(next) {
      enabled = next;
      invincibility.refresh();
    },
    status,
  };
}
