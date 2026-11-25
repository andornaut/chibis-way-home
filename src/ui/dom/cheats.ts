import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { SETTINGS_LAYOUT } from "../layout/settingsCard.ts";
import { closeButton, setCardWidth } from "./card.ts";
import { createTextButtonElement } from "./cardElements.ts";
import { createToggleValue, showToggleValue } from "./toggleValue.ts";

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
  readonly body: HTMLElement;
  readonly closeX: HTMLButtonElement;
  readonly dialog: HTMLElement;
  readonly invincibility: HTMLButtonElement;
  readonly root: HTMLElement;
  readonly status: HTMLElement;
}

// The unlock actions, contact-invincibility switch and Back fit in one column.
export function createCheatsCard(
  document: Document,
  id: string,
  words: CheatsCardWords,
): CheatsCardView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  };
  const text = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    value: string,
  ) => {
    const node = element(tag, className);
    node.textContent = value;
    return node;
  };
  const root = element("div", "ui-card-scene");
  writeLayoutProperties(SETTINGS_LAYOUT, root);
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  const dialog = element("section", "ui-card ui-frame ui-card-closeable cheats-card");
  setCardWidth("medium", dialog);
  dialog.id = id;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  const header = element("div", "ui-card-header");
  const heading = text("h2", "ui-card-title", words.title);
  heading.id = `${id}-title`;
  header.append(heading);
  const body = element("div", "cheats-body");
  const actionColumn = element(
    "div",
    "ui-card-actions ui-control-group ui-button-stack cheats-actions",
  );
  actionColumn.dataset.uiAxis = "stack";
  const actions = {
    unlockAllPowerUps: createTextButtonElement(document, words.unlockAllPowerUps),
    unlockAllZones: createTextButtonElement(document, words.unlockAllZones),
  };
  actionColumn.append(actions.unlockAllPowerUps, actions.unlockAllZones);
  const invincibility = element("button", "settings-row ui-press");
  invincibility.type = "button";
  invincibility.setAttribute("role", "switch");
  invincibility.setAttribute("aria-checked", "false");
  const label = text("span", "settings-label", words.invulnerable);
  label.id = `${id}-invulnerable`;
  invincibility.setAttribute("aria-labelledby", label.id);
  const name = element("span", "settings-name");
  const note = text("span", "settings-note", words.invulnerableNote);
  note.id = `${id}-invulnerable-note`;
  invincibility.setAttribute("aria-describedby", note.id);
  name.append(label, note);
  const value = createToggleValue(document);
  invincibility.append(name, value);
  body.append(actionColumn, invincibility);
  const status = element("p", "ui-card-text cheats-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const footer = element("div", "ui-card-actions cheats-footer");
  const back = createTextButtonElement(document, words.back, true);
  footer.append(back);
  const closeX = closeButton(document, words.close);
  dialog.append(header, body, status, footer, closeX);
  view.append(dialog);
  root.append(backdrop, view);
  return { actions, back, backdrop, body, closeX, dialog, invincibility, root, status };
}

export function showCheats(
  enabled: boolean,
  words: CheatsCardWords["state"],
  view: CheatsCardView,
): void {
  view.invincibility.setAttribute("aria-checked", String(enabled));
  showToggleValue(
    words[enabled ? "on" : "off"],
    view.invincibility.querySelector<HTMLElement>(".settings-toggle-value")!,
  );
}
