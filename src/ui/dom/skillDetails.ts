import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { SKILL_DETAILS } from "../../data/layout.ts";
import { type ActionHelpWords, createActionHelp } from "./actionHelp.ts";
import { closeButton } from "./card.ts";
import { createSkillDisc } from "./skillDisc.ts";

// The skill details card in the HTML UI (skillDetails.css, on ui.css's .ui-card): its title, the
// skill's ready disc beside its description with inline control illustrations, and the close X.

// The layout properties skillDetails.css reads, in base px.
export const SKILL_DETAILS_LAYOUT: LayoutValues = {
  "--skill-details-width": SKILL_DETAILS.descriptionWidth,
};

export interface SkillDetailsWords extends ActionHelpWords {
  // The close X's accessible name.
  readonly close: string;
  readonly description: string;
  // The disc's accessible name.
  readonly disc: string;
  readonly title: string;
}

// The palette colours the card draws its SVG in, as 0xrrggbb.
export interface SkillDetailsColours {
  readonly cream: number;
  readonly ink: number;
  readonly navy: number;
  readonly white: number;
  readonly yellow: number;
}

export interface SkillDetailsView {
  readonly backdrop: HTMLElement;
  readonly close: HTMLButtonElement;
  // The card itself: role dialog, named by its title and described by its description.
  readonly dialog: HTMLElement;
  // The disc's glyph, whose source the caller sets.
  readonly glyph: HTMLImageElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// The card for words, its dialog identified by id, which its title's and description's ids extend.
export function createSkillDetailsCard(
  document: Document,
  colours: SkillDetailsColours,
  id: string,
  words: SkillDetailsWords,
): SkillDetailsView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const root = element("div", "ui-card-scene");
  writeLayoutProperties(SKILL_DETAILS_LAYOUT, root);
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  const dialog = element("section", "ui-card ui-frame ui-card-closeable skill-details-card");
  dialog.id = id;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  dialog.setAttribute("aria-describedby", `${id}-description`);
  const header = element("div", "ui-card-header");
  const title = element("h2", "ui-card-title");
  title.id = `${id}-title`;
  title.textContent = words.title;
  header.append(title);
  const body = element("div", "skill-details-body");
  // The ready, unselected disc: a yellow face and an ink glyph.
  const disc = createSkillDisc(document, colours, { ready: true, selected: false }, words.disc);
  const description = element("p", "skill-details-description");
  description.id = `${id}-description`;
  description.append(...createActionHelp(document, colours, words, words.description));
  body.append(disc.element, description);
  const close = closeButton(document, words.close);
  dialog.append(header, body, close);
  view.append(dialog);
  root.append(backdrop, view);
  return { backdrop, close, dialog, glyph: disc.glyph, root };
}
