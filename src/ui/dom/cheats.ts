import type { SkillId } from "../../data/types/index.ts";
import { closeButton, setCardWidth } from "./card.ts";
import { createTextButtonElement } from "./cardElements.ts";

// The Cheats card and its Reset save confirmation (cheats.css, on ui.css's .ui-card and
// settings.css's rows), shown in the settings card's place in its view. The Cheats group starts with
// power-up and Invulnerability switches and both unlock actions, followed by the stage controls.
// Tools follows in the scroll body. Status and the primary Close stay outside it. The confirmation
// is an alert dialog with its body text, Cancel and Reset.

export type CheatSwitch = "fps" | "invulnerable" | `powerUp:${SkillId}`;

export type CheatAction =
  "load" | "resetSave" | "showTipsAgain" | "unlockAllPowerUps" | "unlockAllZones";

export type CheatPicker = "stage" | "zone";

export interface CheatsCardWords {
  readonly close: string;
  readonly confirm: {
    readonly accept: string;
    readonly body: string;
    readonly cancel: string;
    readonly title: string;
  };
  readonly fps: string;
  readonly group: string;
  readonly groupDescription: string;
  readonly invulnerable: string;
  readonly load: string;
  // Each power-up's enable label, its {skill} already filled.
  readonly powerUps: Readonly<Record<SkillId, string>>;
  readonly resetSave: string;
  readonly showTipsAgain: string;
  readonly stage: string;
  readonly state: { readonly off: string; readonly on: string };
  readonly title: string;
  readonly tools: string;
  readonly unlockAllPowerUps: string;
  readonly unlockAllZones: string;
  readonly zone: string;
}

export interface CheatsCardView {
  readonly actions: Readonly<Record<CheatAction, HTMLButtonElement>>;
  readonly close: HTMLButtonElement;
  readonly closeX: HTMLButtonElement;
  readonly confirm: {
    readonly accept: HTMLButtonElement;
    readonly cancel: HTMLButtonElement;
    readonly close: HTMLButtonElement;
    readonly dialog: HTMLElement;
  };
  readonly dialog: HTMLElement;
  readonly pickers: Readonly<Record<CheatPicker, HTMLButtonElement>>;
  readonly scrollBody: HTMLElement;
  readonly status: HTMLElement;
  readonly switches: Readonly<Record<CheatSwitch, HTMLButtonElement>>;
}

// The cards for words, a switch for each of skills' enables, identified by id and `${id}-confirm`,
// which their titles' and rows' ids extend. The caller places both dialogs.
export function createCheatsCard(
  document: Document,
  id: string,
  words: CheatsCardWords,
  skills: readonly SkillId[],
): CheatsCardView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const text = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    value: string,
  ) => {
    const created = element(tag, className);
    created.textContent = value;
    return created;
  };
  const dialog = element("section", "ui-card ui-frame ui-card-closeable cheats-card");
  setCardWidth("large", dialog);
  dialog.id = id;
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  const header = element("div", "ui-card-header");
  const heading = text("h2", "ui-card-title", words.title);
  heading.id = `${id}-title`;
  header.append(heading);
  const body = element("div", "cheats-body ui-card-scroll");
  // A row's button named by its label, with its value at its right end.
  const row = (key: string, label: string, value: HTMLElement, into: HTMLElement) => {
    const button = element("button", "settings-row ui-press");
    button.type = "button";
    const name = element("span", "settings-name");
    const labelText = text("span", "settings-label", label);
    labelText.id = `${id}-${key.replace(":", "-")}`;
    button.setAttribute("aria-labelledby", labelText.id);
    name.append(labelText);
    button.append(name, value);
    into.append(button);
    return button;
  };
  const switchRow = (key: CheatSwitch, label: string, into: HTMLElement) => {
    const value = element("span", "settings-value");
    const state = element("span", "settings-state");
    state.setAttribute("aria-hidden", "true");
    const toggle = element("span", "settings-switch");
    toggle.setAttribute("aria-hidden", "true");
    value.append(state, toggle);
    const button = row(key, label, value, into);
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", "false");
    return button;
  };
  const pickerRow = (key: CheatPicker, label: string, into: HTMLElement) => {
    const value = element("span", "settings-value cheats-choice");
    const button = row(key, label, value, into);
    button.classList.add("cheats-picker");
    // The choice is read with the label: the label names the row, the choice describes it.
    value.id = `${id}-${key}-choice`;
    button.setAttribute("aria-describedby", value.id);
    return button;
  };
  const button = (label: string, into: HTMLElement) => {
    const created = createTextButtonElement(document, label);
    into.append(created);
    return created;
  };
  const rows = () => element("div", "settings-rows cheats-rows");
  const cheats = element("section", "cheats-group");
  cheats.setAttribute("aria-label", words.group);
  const switchGrid = rows();
  switchGrid.classList.add("cheats-switches");
  const unlockGrid = rows();
  const stageGrid = rows();
  cheats.append(
    text("p", "ui-card-text cheats-group-text", words.groupDescription),
    switchGrid,
    unlockGrid,
    stageGrid,
  );
  const switches: Partial<Record<CheatSwitch, HTMLButtonElement>> = {};
  for (const skill of skills) {
    switches[`powerUp:${skill}`] = switchRow(`powerUp:${skill}`, words.powerUps[skill], switchGrid);
  }
  switches.invulnerable = switchRow("invulnerable", words.invulnerable, switchGrid);
  const unlockAllPowerUps = button(words.unlockAllPowerUps, unlockGrid);
  const unlockAllZones = button(words.unlockAllZones, unlockGrid);
  const zone = pickerRow("zone", words.zone, stageGrid);
  const stage = pickerRow("stage", words.stage, stageGrid);
  const pickers = { stage, zone };
  const load = button(words.load, stageGrid);
  const tools = element("section", "cheats-group");
  const toolsHeading = text("h3", "cheats-group-title", words.tools);
  toolsHeading.id = `${id}-tools`;
  tools.setAttribute("aria-labelledby", toolsHeading.id);
  const toolGrid = rows();
  switches.fps = switchRow("fps", words.fps, toolGrid);
  const showTipsAgain = button(words.showTipsAgain, toolGrid);
  const resetSave = button(words.resetSave, toolGrid);
  tools.append(toolsHeading, toolGrid);
  body.append(cheats, tools);
  const status = element("p", "ui-card-text cheats-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const actionRow = element("div", "ui-card-actions ui-control-group");
  actionRow.dataset.uiAxis = "row";
  const close = createTextButtonElement(document, words.close, true);
  actionRow.append(close);
  const closeX = closeButton(document, words.close);
  dialog.append(header, body, status, actionRow, closeX);

  const confirm = element("section", "ui-card ui-frame ui-card-closeable cheats-confirm");
  setCardWidth("small", confirm);
  confirm.id = `${id}-confirm`;
  confirm.hidden = true;
  confirm.setAttribute("role", "alertdialog");
  confirm.setAttribute("aria-labelledby", `${id}-confirm-title`);
  confirm.setAttribute("aria-describedby", `${id}-confirm-text`);
  const confirmHeader = element("div", "ui-card-header");
  const confirmTitle = text("h2", "ui-card-title", words.confirm.title);
  confirmTitle.id = `${id}-confirm-title`;
  confirmHeader.append(confirmTitle);
  const confirmText = text("p", "ui-card-text", words.confirm.body);
  confirmText.id = `${id}-confirm-text`;
  const confirmActions = element("div", "ui-card-actions ui-control-group");
  confirmActions.dataset.uiAxis = "row";
  const cancel = createTextButtonElement(document, words.confirm.cancel);
  const accept = createTextButtonElement(document, words.confirm.accept, true);
  confirmActions.append(cancel, accept);
  const confirmClose = closeButton(document, words.close);
  confirm.append(confirmHeader, confirmText, confirmActions, confirmClose);
  return {
    actions: { load, resetSave, showTipsAgain, unlockAllPowerUps, unlockAllZones },
    close,
    closeX,
    confirm: { accept, cancel, close: confirmClose, dialog: confirm },
    dialog,
    pickers,
    scrollBody: body,
    status,
    switches: switches as Record<CheatSwitch, HTMLButtonElement>,
  };
}

// Shows each switch on or off as on states it, and each picker's choice.
export function showCheats(
  on: (setting: CheatSwitch) => boolean,
  choices: Readonly<Record<CheatPicker, string>>,
  words: CheatsCardWords["state"],
  view: CheatsCardView,
): void {
  for (const [setting, button] of Object.entries(view.switches) as [
    CheatSwitch,
    HTMLButtonElement,
  ][]) {
    const enabled = on(setting);
    button.setAttribute("aria-checked", String(enabled));
    button.querySelector<HTMLElement>(".settings-state")!.textContent =
      words[enabled ? "on" : "off"];
  }
  for (const [picker, button] of Object.entries(view.pickers) as [
    CheatPicker,
    HTMLButtonElement,
  ][]) {
    button.querySelector<HTMLElement>(".cheats-choice")!.textContent = choices[picker];
  }
}
