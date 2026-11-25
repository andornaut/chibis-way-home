import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { SKILL_DETAILS } from "../../data/layout.ts";
import { type ActionHelpWords, createActionHelp } from "./actionHelp.ts";
import { createCardFrame } from "./cardFrame.ts";
import { createSkillDisc } from "./skillDisc.ts";

// The skill details card in the HTML UI (skillDetails.css, on cardFrame.ts): its title, the
// skill's ready disc beside its description with inline control illustrations, and the close X.

// The layout properties skillDetails.css reads, in base px.
export const SKILL_DETAILS_LAYOUT: LayoutValues = {
  "--skill-details-width": SKILL_DETAILS.descriptionWidth,
};

export interface SkillSummaryWords extends ActionHelpWords {
  readonly description: string;
  // The disc's accessible name.
  readonly disc: string;
}

export interface SkillDetailsWords extends SkillSummaryWords {
  // The close X's accessible name.
  readonly close: string;
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

export interface SkillSummaryView {
  // The description, a wrapped paragraph identified by the id given.
  readonly description: HTMLElement;
  readonly element: HTMLElement;
  // The disc's glyph, whose source the caller sets.
  readonly glyph: HTMLImageElement;
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

// A skill's ready, unselected disc (a yellow face and an ink glyph) beside its description, a
// start-aligned paragraph with inline control illustrations, identified by id.
export function createSkillSummary(
  document: Document,
  colours: SkillDetailsColours,
  id: string,
  words: SkillSummaryWords,
): SkillSummaryView {
  const element = document.createElement("div");
  element.className = "skill-details-body";
  const disc = createSkillDisc(document, colours, { ready: true }, words.disc);
  const description = document.createElement("p");
  description.className = "skill-details-description ui-card-paragraph ui-text-body";
  description.id = id;
  description.append(...createActionHelp(document, colours, words, words.description));
  element.append(disc.element, description);
  return { description, element, glyph: disc.glyph };
}

// The card for words, its dialog identified by id, which its title's and description's ids extend.
export function createSkillDetailsCard(
  document: Document,
  colours: SkillDetailsColours,
  id: string,
  words: SkillDetailsWords,
): SkillDetailsView {
  // The disc beside a description up to its full width.
  const frame = createCardFrame(document, {
    className: "skill-details-card",
    close: words.close,
    id,
    title: words.title,
    width: "large",
  });
  writeLayoutProperties(SKILL_DETAILS_LAYOUT, frame.root);
  const summary = createSkillSummary(document, colours, `${id}-description`, words);
  frame.dialog.setAttribute("aria-describedby", summary.description.id);
  frame.content.append(summary.element);
  return {
    backdrop: frame.backdrop,
    close: frame.close!,
    dialog: frame.dialog,
    glyph: summary.glyph,
    root: frame.root,
  };
}
