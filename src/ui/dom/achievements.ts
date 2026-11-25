import type { ButtonSize } from "@andornaut/game-kit/runtime/ui/buttonLayout";
import { pagerSize, type PagerState } from "@andornaut/game-kit/runtime/ui/pager";
import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";
import type { PagerView } from "@andornaut/game-kit/runtime/web/ui/dom/pager";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { createGamePager, type GameAction } from "../input/actionBinding.ts";
import { achievementsCardProperties } from "../layout/achievementsCard.ts";
import { setTextButtonRole } from "./buttonLayout.ts";
import { createCardFrame, TEXT_BUTTON_APPEARANCE, textButton } from "./card.ts";
import { registerLayout, rendered } from "./layout.ts";

// The Achievements card in the HTML UI (achievements.css) on the card frame: its title, a list
// of every entry, a page of them at a time, and a footer that stacks the pager (Previous, the
// page count and Next) above Back. The keyboard's focus moves through Previous, Next, Back and
// the close X in that order.

// One entry's words and state: its progress is a locked entry's count, where it has one.
export interface AchievementsCardEntry {
  readonly description: string;
  readonly earned: boolean;
  readonly progress?: string;
  readonly title: string;
}

export interface AchievementsCardWords {
  readonly back: string;
  readonly close: string;
  readonly locked: string;
  readonly next: string;
  readonly previous: string;
  readonly title: string;
  readonly unlocked: string;
}

// The pager's page, its count's words, its guard and its step, from the scene.
export interface AchievementsPager {
  readonly active: () => boolean;
  readonly countText: (state: PagerState) => string;
  readonly state: () => PagerState;
  readonly step: (direction: -1 | 1) => void;
}

export type AchievementsTarget = "back" | "close" | "next" | "previous";

export interface AchievementsCardView {
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<AchievementsTarget, HTMLButtonElement>>;
  // The card itself: role dialog, named by its title.
  readonly dialog: HTMLElement;
  // Each entry's list item and icon, in entry order.
  readonly entries: readonly { readonly icon: HTMLImageElement; readonly item: HTMLElement }[];
  readonly pager: PagerView;
  // Previous and Next as the actions the scene binds.
  readonly pagerActions: readonly GameAction[];
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// The card for words and entries, its dialog identified by id, which its title's id extends. An
// entry's icon states whether it is earned, as its text alternative; the caller sets its source.
export function createAchievementsCard(
  document: Document,
  id: string,
  words: AchievementsCardWords,
  paging: AchievementsPager,
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
  // Two entry columns take the large width family.
  const frame = createCardFrame(document, {
    className: "achievements-card",
    close: words.close,
    id,
    title: words.title,
    width: "large",
  });
  writeLayoutProperties(achievementsCardProperties(entries.length), frame.root);
  const list = element("ul", "achievements-list ui-text-body");
  const shown = entries.map((entry) => {
    const item = element("li", "achievements-entry");
    item.toggleAttribute("data-earned", entry.earned);
    const icon = element("img", "achievements-icon");
    icon.alt = entry.earned ? words.unlocked : words.locked;
    const heading = element("p", "achievements-heading");
    heading.append(text("span", "achievements-title ui-text-label", entry.title));
    if (entry.progress !== undefined) {
      heading.append(text("span", "achievements-progress", entry.progress));
    }
    const body = element("div", "achievements-text");
    body.append(heading, text("p", "achievements-description", entry.description));
    item.append(icon, body);
    return { icon, item };
  });
  list.append(...shown.map(({ item }) => item));
  frame.content.append(list);
  const { actions, view: pager } = createGamePager(document, {
    active: paging.active,
    appearance: TEXT_BUTTON_APPEARANCE,
    className: "achievements-pager",
    countText: paging.countText,
    labels: { next: words.next, previous: words.previous },
    state: paging.state,
    step: paging.step,
  });
  pager.count.classList.add("ui-text-body");
  setTextButtonRole(false, pager.previous.element);
  setTextButtonRole(false, pager.next.element);
  const back = textButton(document, words.back, true);
  // The footer's middle slot, which a stacked footer puts first: the pager, at its measured size.
  const footer: {
    readonly axis: "stack";
    middle: { readonly element: HTMLElement; readonly size: ButtonSize };
  } = {
    axis: "stack",
    middle: { element: pager.element, size: { height: TEXT_BUTTON.height, width: 1 } },
  };
  frame.frame.footer.element.append(pager.element);
  frame.setFooter([back], footer);
  // The pager's parts in its own box, then the card around it.
  registerLayout(() => {
    if (!rendered(frame.frame.element)) {
      return;
    }
    const sizes = pager.measure();
    const size = pagerSize(sizes);
    pager.arrange({ sizes, width: size.width });
    footer.middle = { element: pager.element, size };
    frame.layout();
  }, pager.element);
  return {
    backdrop: frame.backdrop,
    buttons: {
      back,
      close: frame.close!,
      next: pager.next.element,
      previous: pager.previous.element,
    },
    dialog: frame.dialog,
    entries: shown,
    pager,
    pagerActions: actions,
    root: frame.root,
  };
}

// Shows page's entries, perPage to a page, and the pager as the page leaves it. No button keeps
// a pressed look across the change.
export function showAchievementsPage(
  page: { readonly page: number; readonly perPage: number },
  view: AchievementsCardView,
): void {
  view.entries.forEach(({ item }, index) => {
    item.hidden = Math.floor(index / page.perPage) !== page.page;
  });
  view.pager.refresh();
  for (const button of Object.values(view.buttons)) {
    delete button.dataset.pressed;
  }
}
