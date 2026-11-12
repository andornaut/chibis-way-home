import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import type { ControlAction } from "../../data/types/index.ts";
import { actionHelpParts } from "../chrome/actionHelp.ts";
import { helpChromeLayers } from "../chrome/helpChrome.ts";
import { TOUCH_CHROME_FRAME } from "../chrome/touchChrome.ts";
import { ACTION_HELP } from "../layout/actionHelp.ts";
import { createPaletteSvg } from "./chrome.ts";

// Text with inline control illustrations in the HTML UI (actionHelp.css): each {move}, {use} or
// {jump} token becomes the action's label in the action weight, then its help illustration, the
// live control's geometry with an opaque face, as inline SVG one body line high with its bottom on
// the line's baseline. The label and its illustration wrap as one.

// The layout properties actionHelp.css reads, in base px.
export const ACTION_HELP_PROPERTIES: LayoutValues = { "--action-help-gap": ACTION_HELP.gap };

export interface ActionHelpWords {
  // Each action's label, shown before its illustration.
  readonly actions: Readonly<Record<ControlAction, string>>;
  // Each illustration's accessible name.
  readonly icons: Readonly<Record<ControlAction, string>>;
}

// One action's illustration, in colours (0xrrggbb), named name, or, for an undefined name,
// decorative and hidden from assistive technology.
export function createActionIcon(
  document: Document,
  colours: Parameters<typeof helpChromeLayers>[0],
  name: string | undefined,
  action: ControlAction,
): HTMLElement {
  const icon = document.createElement("span");
  icon.className = "ui-action-help-icon";
  icon.dataset.action = action;
  if (name === undefined) {
    icon.setAttribute("aria-hidden", "true");
  } else {
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", name);
  }
  icon.append(
    createPaletteSvg(
      document,
      colours,
      { height: TOUCH_CHROME_FRAME, width: TOUCH_CHROME_FRAME },
      helpChromeLayers(colours, action),
    ),
  );
  return icon;
}

// text's runs and actions as nodes for a paragraph: text nodes, and a span holding each action's
// label and illustration.
export function createActionHelp(
  document: Document,
  colours: Parameters<typeof helpChromeLayers>[0],
  words: ActionHelpWords,
  text: string,
): Node[] {
  return actionHelpParts(text).map((part) => {
    if (part.kind === "text") {
      return document.createTextNode(part.text);
    }
    const unit = document.createElement("span");
    unit.className = "ui-action-help-action";
    writeLayoutProperties(ACTION_HELP_PROPERTIES, unit);
    const label = document.createElement("span");
    label.className = "ui-action-help-label";
    label.textContent = words.actions[part.action];
    unit.append(label, createActionIcon(document, colours, words.icons[part.action], part.action));
    return unit;
  });
}
