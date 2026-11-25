import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, DEATH_CARD } from "../../data/layout.ts";
import type { DeathAction } from "../input/deathInput.ts";
import type { StatsMetricRow } from "../layout/runStats.ts";
import { type ActionsView, createActions } from "./actions.ts";
import { textButton } from "./card.ts";
import { createCardFrame } from "./cardFrame.ts";
import { createRunStats } from "./runStats.ts";

// The required death card in the HTML UI (death.css, on cardFrame.ts): the zone's name as its
// title, the stage and progress lines, the antagonist's statement, the stage's metrics and the
// totals in two columns either side of an ink divider, and Back to title and Try again side by
// side, centred. It has no close: only its actions leave it.

export interface DeathCardWords {
  // Each button's key and label, in the order the keyboard's focus moves through them.
  readonly actions: readonly { readonly key: DeathAction; readonly label: string }[];
  // The card's accessible name.
  readonly label: string;
  readonly progress: string;
  readonly stage: string;
  // The current stage's metrics, in the column's order.
  readonly stats: readonly StatsMetricRow[];
  readonly statement?: string;
  readonly title: string;
  readonly totals: readonly StatsMetricRow[];
}

export interface DeathCardView {
  // The two actions' group.
  readonly actions: ActionsView;
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<DeathAction, HTMLButtonElement>>;
  // The card itself: role alertdialog, named by its label and described by its lines.
  readonly dialog: HTMLElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// The layout properties death.css reads, written on the card's view: the line box of one line and
// the gap between stacked lines.
export const DEATH_LAYOUT: LayoutValues = {
  "--death-line": CARD_CONTENT.lineHeight,
  "--death-row-gap": CARD_CONTENT.rowGap,
};

const ID = "death-card";

// The death card for words. Its actions are primary Try again and Back to title, in focus order;
// their group shows Back to title on the left.
export function createDeathCard(document: Document, words: DeathCardWords): DeathCardView {
  const line = (key: string, text: string) => {
    const paragraph = document.createElement("p");
    paragraph.className = "ui-death-line ui-text-body";
    paragraph.id = `${ID}-${key}`;
    paragraph.textContent = text;
    return paragraph;
  };
  // The stage's metrics beside the totals, and two actions side by side.
  const frame = createCardFrame(document, {
    alert: true,
    className: "ui-death-card",
    id: ID,
    sceneClassName: "ui-death-scene",
    title: words.title,
    width: "large",
  });
  writeLayoutProperties(DEATH_LAYOUT, frame.root);
  const identity = document.createElement("div");
  identity.className = "ui-death-identity";
  identity.append(line("stage", words.stage), line("progress", words.progress));
  const statement = words.statement === undefined ? [] : [line("statement", words.statement)];
  // Named by its label, which says more than its title, and described by its lines.
  frame.dialog.removeAttribute("aria-labelledby");
  frame.dialog.setAttribute("aria-label", words.label);
  frame.dialog.setAttribute(
    "aria-describedby",
    [...identity.children, ...statement].map(({ id }) => id).join(" "),
  );
  const stats = createRunStats(
    document,
    { columnGap: 2 * CARD_CONTENT.gap, divider: DEATH_CARD.dividerWidth },
    [words.stats, words.totals],
  );
  const buttons = Object.fromEntries(
    words.actions.map(({ key, label }) => {
      const button = textButton(document, label, key === "retry");
      button.dataset.action = key;
      return [key, button];
    }),
  ) as Record<DeathAction, HTMLButtonElement>;
  const actions = createActions(
    document,
    words.actions.map(({ key }) => buttons[key]),
    { className: "ui-card-actions ui-death-actions" },
  );
  frame.content.append(identity, ...statement, stats, actions.element);
  return { actions, backdrop: frame.backdrop, buttons, dialog: frame.dialog, root: frame.root };
}
