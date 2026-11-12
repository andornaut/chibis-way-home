import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { achievementsCardProperties } from "../layout/achievementsCard.ts";
import { closeButton, textButton } from "./card.ts";

// The Achievements card in the HTML UI (achievements.css, on ui.css's .ui-card): its title, a
// list of every entry, a page of them at a time, Previous, the page count and Next, and the close
// X. The close X comes last in the card, so the keyboard's focus moves through Previous, Next and
// the close X in that order.

// One entry's words and state: its progress is a locked entry's count, where it has one.
export interface AchievementsCardEntry {
  readonly description: string;
  readonly earned: boolean;
  readonly progress?: string;
  readonly title: string;
}

export interface AchievementsCardWords {
  readonly close: string;
  readonly locked: string;
  readonly next: string;
  readonly previous: string;
  readonly title: string;
  readonly unlocked: string;
}

export type AchievementsTarget = "close" | "next" | "previous";

export interface AchievementsCardView {
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<AchievementsTarget, HTMLButtonElement>>;
  // The card itself: role dialog, named by its title.
  readonly dialog: HTMLElement;
  // Each entry's list item and icon, in entry order.
  readonly entries: readonly { readonly icon: HTMLImageElement; readonly item: HTMLElement }[];
  readonly pageCount: HTMLElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// The card for words and entries, its dialog identified by id, which its title's id extends. An
// entry's icon states whether it is earned, as its text alternative; the caller sets its source.
export function createAchievementsCard(
  document: Document,
  id: string,
  words: AchievementsCardWords,
  entries: readonly AchievementsCardEntry[],
): AchievementsCardView {
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
  const root = element("div", "ui-card-scene");
  writeLayoutProperties(achievementsCardProperties(entries.length), root);
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  const dialog = element("section", "ui-card ui-frame ui-card-closeable achievements-card");
  dialog.id = id;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  const header = element("div", "achievements-header");
  const title = text("h2", "ui-card-title", words.title);
  title.id = `${id}-title`;
  header.append(title);
  const list = element("ul", "achievements-list");
  const shown = entries.map((entry) => {
    const item = element("li", "achievements-entry");
    item.toggleAttribute("data-earned", entry.earned);
    const icon = element("img", "achievements-icon");
    icon.alt = entry.earned ? words.unlocked : words.locked;
    const heading = element("p", "achievements-heading");
    heading.append(text("span", "achievements-title", entry.title));
    if (entry.progress !== undefined) {
      heading.append(text("span", "achievements-progress", entry.progress));
    }
    const body = element("div", "achievements-text");
    body.append(heading, text("p", "achievements-description", entry.description));
    item.append(icon, body);
    return { icon, item };
  });
  list.append(...shown.map(({ item }) => item));
  const pager = element("div", "achievements-pager");
  const pageCount = element("p", "achievements-page");
  pageCount.setAttribute("aria-live", "polite");
  const buttons = {
    close: closeButton(document, words.close),
    next: textButton(document, words.next),
    previous: textButton(document, words.previous),
  };
  pager.append(buttons.previous, pageCount, buttons.next);
  dialog.append(header, list, pager, buttons.close);
  view.append(dialog);
  root.append(backdrop, view);
  return { backdrop, buttons, dialog, entries: shown, pageCount, root };
}

// Shows page's entries, perPage to a page, its count as countText, and Previous and Next enabled
// where there is a page before or after it. No button keeps a pressed look across the change.
export function showAchievementsPage(
  page: { readonly countText: string; readonly page: number; readonly perPage: number },
  view: AchievementsCardView,
): void {
  const { countText, perPage } = page;
  const pages = Math.ceil(view.entries.length / perPage);
  view.entries.forEach(({ item }, index) => {
    item.hidden = Math.floor(index / perPage) !== page.page;
  });
  view.buttons.previous.disabled = page.page === 0;
  view.buttons.next.disabled = page.page + 1 >= pages;
  for (const button of Object.values(view.buttons)) {
    delete button.dataset.pressed;
  }
  view.pageCount.textContent = countText;
}
