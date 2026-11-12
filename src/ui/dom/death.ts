import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { CARD_CONTENT, DEATH_CARD } from "../../data/layout.ts";
import type { DeathAction } from "../input/deathInput.ts";
import type { StatsMetricRow } from "../layout/runStats.ts";
import { textButton } from "./card.ts";
import { createRunStats } from "./runStats.ts";

// The required death card in the HTML UI (death.css): over a full-area backdrop that takes every
// press outside it, the card on the play view in art's ui-settings-card frame, with the zone's
// name, the stage and progress lines, the antagonist's statement, the stage's metrics and the
// totals in two columns either side of an ink divider, and Back to title and Try again. It has
// no close: only its actions leave it.

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
// death.css shows Back to title on the left.
export function createDeathCard(document: Document, words: DeathCardWords): DeathCardView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const line = (key: string, text: string) => {
    const paragraph = element("p", "ui-death-line");
    paragraph.id = `${ID}-${key}`;
    paragraph.textContent = text;
    return paragraph;
  };
  const root = element("div", "ui-card-scene ui-death-scene");
  writeLayoutProperties(DEATH_LAYOUT, root);
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  const dialog = element("section", "ui-card ui-frame ui-death-card");
  dialog.id = ID;
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-label", words.label);
  const title = element("h2", "ui-card-title");
  title.id = `${ID}-title`;
  title.textContent = words.title;
  const identity = element("div", "ui-death-identity");
  identity.append(line("stage", words.stage), line("progress", words.progress));
  const statement = words.statement === undefined ? [] : [line("statement", words.statement)];
  dialog.setAttribute(
    "aria-describedby",
    [...identity.children, ...statement].map(({ id }) => id).join(" "),
  );
  const stats = createRunStats(
    document,
    { columnGap: 2 * CARD_CONTENT.gap, divider: DEATH_CARD.dividerWidth },
    [words.stats, words.totals],
  );
  const actions = element("div", "ui-card-actions ui-death-actions");
  const buttons = Object.fromEntries(
    words.actions.map(({ key, label }) => {
      const button = textButton(document, label, key === "retry");
      button.dataset.action = key;
      return [key, button];
    }),
  ) as Record<DeathAction, HTMLButtonElement>;
  actions.append(...words.actions.map(({ key }) => buttons[key]));
  dialog.append(title, identity, ...statement, stats, actions);
  view.append(dialog);
  root.append(backdrop, view);
  return { backdrop, buttons, dialog, root };
}
