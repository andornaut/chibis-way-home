import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { DIALOGUE_PANEL_ALPHA } from "../../data/dialogues.ts";
import { DIALOGUE_LAYOUT } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { DialogueSpeaker } from "../../data/types/index.ts";
import type { DialogueControl } from "../dialogue/conversation.ts";
import {
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueSpeakerLayout,
} from "../layout/dialogueScreen.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import { textButton } from "./card.ts";

// The dialogue panel in the HTML UI (dialogue.css, on ui.css): art's ui-dialogue-box at the
// panel's alpha across the top of the view, the portrait in art's ui-portrait-frame at the
// speaker's end, the speaker's name tab in art's ui-name-tab of their colour above the panel's
// other end, and the paragraph's text column. Conversations, barks and unlock notices share it;
// a conversation adds Skip and Continue below it, and the room's gift panel still draws it on the
// canvas (src/scenes/dialogueParagraph.ts).

const { box } = DIALOGUE_SCREEN;
const { footer, nameTab } = DIALOGUE_LAYOUT;

// The layout properties dialogue.css reads, in base px, written on each panel's scene view.
export const DIALOGUE_PANEL_LAYOUT: LayoutValues = {
  "--dialogue-alpha": DIALOGUE_PANEL_ALPHA,
  "--dialogue-frame": dialogueSpeakerLayout("left").portraitFrame.width,
  "--dialogue-frame-inset": DIALOGUE_LAYOUT.portraitInset,
  "--dialogue-height": box.height,
  "--dialogue-line": DIALOGUE_SCREEN.text.pitch,
  "--dialogue-padding": DIALOGUE_SCREEN.padding,
  "--dialogue-portrait": DIALOGUE_PORTRAIT_SIZE,
  "--dialogue-tab-end": nameTab.endInset,
  "--dialogue-tab-height": nameTab.height,
  "--dialogue-tab-inset": nameTab.inset,
  "--dialogue-tab-overhang": nameTab.overhang,
  // The text column's left edge in from the panel's, beside each speaker's portrait.
  "--dialogue-text-left": dialogueSpeakerLayout("left").textX - box.x,
  "--dialogue-text-right": dialogueSpeakerLayout("right").textX - box.x,
  "--dialogue-text-width": DIALOGUE_SCREEN.text.width,
  "--dialogue-width": box.width,
  "--dialogue-x": box.x,
  "--dialogue-y": box.y,
};

// The layout properties of a conversation's Skip and Continue, in base px: their faces' height
// and least width, how far each press area reaches past its face, and where the faces' row sits:
// its gap below the panel and its right edge's distance from the view's, or the departure's
// inset from the view's bottom-right corner.
export const DIALOGUE_FOOTER_LAYOUT: LayoutValues = {
  "--dialogue-button-height": footer.height,
  "--dialogue-button-width": DIALOGUE_LAYOUT.buttonWidth,
  "--dialogue-departure-inset": DIALOGUE_LAYOUT.departureInset,
  "--dialogue-footer-hit": hitMargin({ height: footer.height, width: footer.height, x: 0, y: 0 }),
  "--dialogue-footer-right": SCREEN.width - box.x - box.width,
  "--dialogue-footer-top": box.y + box.height + footer.gap,
};

// A paragraph as the panel shows it: its speaker's side, and their name tab, or none for a null
// name; a heading is a bold first line above the text, in place of a name tab.
export type PanelParagraph = {
  readonly heading?: string;
  readonly side: DialogueSpeaker["side"];
  readonly text: string;
} & (
  { readonly colour: DialogueSpeaker["colour"]; readonly name: string } | { readonly name: null }
);

export interface DialoguePanelView {
  readonly element: HTMLElement;
  // The bold first line, shown for a paragraph with a heading.
  readonly heading: HTMLElement;
  // The paragraph's text, which announces each new paragraph politely.
  readonly line: HTMLElement;
  // The portrait, whose source the caller sets. Its name is the name tab's, so it has none.
  readonly portrait: HTMLImageElement;
  // The speaker's name tab, the region's heading.
  readonly tab: HTMLElement;
}

const element = <K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
) => {
  const created = document.createElement(tag);
  created.className = className;
  return created;
};

// An empty panel, its parts identified by id.
export function createDialoguePanel(document: Document, id: string): DialoguePanelView {
  const panel = element(document, "div", "dialogue-panel");
  const frame = element(document, "div", "dialogue-portrait-frame");
  const portrait = element(document, "img", "dialogue-portrait");
  portrait.alt = "";
  frame.append(portrait);
  const tab = element(document, "h2", "dialogue-name-tab ui-frame");
  tab.id = `${id}-name`;
  tab.hidden = true;
  const words = element(document, "div", "dialogue-words");
  const heading = element(document, "p", "dialogue-heading");
  heading.hidden = true;
  const line = element(document, "p", "dialogue-line");
  line.id = `${id}-line`;
  words.append(heading, line);
  const column = element(document, "div", "dialogue-text");
  column.append(words);
  panel.append(element(document, "div", "dialogue-box"), frame, tab, column);
  return { element: panel, heading, line, portrait, tab };
}

// Shows paragraph in panel: the portrait at the speaker's end, the name tab or heading, and the
// text.
export function showPanelParagraph(panel: DialoguePanelView, paragraph: PanelParagraph): void {
  panel.element.dataset.side = paragraph.side;
  const tabbed = paragraph.name !== null && paragraph.heading === undefined;
  panel.tab.hidden = !tabbed;
  if (paragraph.name !== null && tabbed) {
    panel.tab.dataset.colour = paragraph.colour;
    panel.tab.textContent = paragraph.name;
  }
  panel.heading.hidden = paragraph.heading === undefined;
  panel.heading.textContent = paragraph.heading ?? "";
  panel.line.textContent = paragraph.text;
}

export interface DialogueWords {
  readonly continue: string;
  // The conversation's accessible name.
  readonly label: string;
  readonly skip: string;
}

export interface DialogueView {
  // The full-area backdrop under the panel, which takes every press off Skip and Continue.
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<DialogueControl, HTMLButtonElement>>;
  // The conversation: role dialog, named by its label, holding the panel and the buttons.
  readonly dialog: HTMLElement;
  // The row of Skip and Continue.
  readonly footer: HTMLElement;
  readonly panel: DialoguePanelView;
  // The cleared stage's preview, filling the view behind a departure's panel; the caller sets its
  // source.
  readonly preview: HTMLImageElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// A conversation's view: the panel, and Continue then Skip in the keyboard's focus order, which
// dialogue.css shows with Skip on the left. A departure (departure true) fills the view with the
// cleared stage's preview and puts the buttons at its bottom-right corner.
export function createDialogueView(
  document: Document,
  departure: boolean,
  id: string,
  words: DialogueWords,
): DialogueView {
  const root = element(document, "div", "dialogue-scene");
  writeLayoutProperties({ ...DIALOGUE_PANEL_LAYOUT, ...DIALOGUE_FOOTER_LAYOUT }, root);
  const backdrop = element(document, "div", "ui-backdrop");
  const view = element(document, "div", "ui-view");
  const preview = element(document, "img", "dialogue-preview");
  preview.alt = "";
  preview.hidden = !departure;
  const dialog = element(document, "section", "dialogue-region");
  dialog.id = id;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", words.label);
  const panel = createDialoguePanel(document, id);
  panel.line.setAttribute("aria-live", "polite");
  const buttons = {
    continue: textButton(document, words.continue, true),
    skip: textButton(document, words.skip),
  };
  buttons.continue.dataset.control = "continue";
  buttons.skip.dataset.control = "skip";
  const footer = element(document, "div", "ui-card-actions dialogue-footer");
  footer.toggleAttribute("data-departure", departure);
  footer.append(buttons.continue, buttons.skip);
  dialog.append(panel.element, footer);
  view.append(preview, dialog);
  root.append(backdrop, view);
  return { backdrop, buttons, dialog, footer, panel, preview, root };
}

export interface StatusPanelView {
  readonly panel: DialoguePanelView;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// A bark's or an unlock notice's view: a polite status region holding the panel, which starts
// hidden. The panel takes no presses itself; its scene reads taps on it from the page.
export function createStatusPanel(document: Document, id: string): StatusPanelView {
  const root = element(document, "div", "dialogue-status-scene");
  writeLayoutProperties(DIALOGUE_PANEL_LAYOUT, root);
  const view = element(document, "div", "ui-view");
  const status = element(document, "div", "dialogue-status");
  status.setAttribute("role", "status");
  const panel = createDialoguePanel(document, id);
  panel.element.hidden = true;
  status.append(panel.element);
  view.append(status);
  root.append(view);
  return { panel, root };
}

// Whether a point in client px is on panel's drawn box or its shown name tab, the panel's one
// press area.
export function onPanel(panel: DialoguePanelView, x: number, y: number): boolean {
  const inside = ({ bottom, left, right, top }: DOMRect) =>
    x >= left && x < right && y >= top && y < bottom;
  return (
    !panel.element.hidden &&
    (inside(panel.element.getBoundingClientRect()) ||
      (!panel.tab.hidden && inside(panel.tab.getBoundingClientRect())))
  );
}
