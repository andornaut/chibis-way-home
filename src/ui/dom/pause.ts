import { BUTTON_GAP, STACK_BUTTON_GAP } from "@andornaut/game-kit/runtime/ui/spacing";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import type { GameText, Point, SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { PAUSE_CHROME_FRAME, type PauseChromePose } from "../chrome/pauseChrome.ts";
import { createGameButton } from "../input/actionBinding.ts";
import { cardWidth } from "../layout/contentCard.ts";
import { PAUSE_BUTTON } from "../layout/pauseCard.ts";
import { SKILL_BUTTON } from "../layout/skillHud.ts";
import { type ActionsContext, type ActionsView, createActions } from "./actions.ts";
import { type CardFrame, createCardFrame, setTextButtonLabel, textButton } from "./card.ts";
import { UI_COVERED } from "./layer.ts";
import { createNavigationDisc } from "./navigationDisc.ts";
import {
  createSkillDisc,
  paintSkillDisc,
  type SkillDiscLook,
  type SkillDiscView,
} from "./skillDisc.ts";

// The pause scene's view in the HTML UI (pause.css, on ui.css and skillDisc.css): the pause card,
// the pause button at the view's top-left corner and the skill HUD along its top-right, each
// button's box its press area. While the card is open the entry and the HUD stay painted over its
// backdrop, dimmed and inert, so a press on them passes to the backdrop: a tap outside the card,
// which closes it. A card under this view (a conversation, its choice or a summary) covers the HUD
// and entry the same way: they stay painted but dim and take no presses beneath the top card.

// The layout properties pause.css reads, in base px.
export const PAUSE_LAYOUT: LayoutValues = {
  "--pause-button-inset": PAUSE_BUTTON.art.x - PAUSE_BUTTON.hit.x,
  "--pause-button-inset-y": PAUSE_BUTTON.art.y - PAUSE_BUTTON.hit.y,
  "--pause-button-size": PAUSE_BUTTON.hit.width,
  "--pause-button-x": PAUSE_BUTTON.hit.x,
  "--pause-button-y": PAUSE_BUTTON.hit.y,
  "--pause-disc-size": PAUSE_CHROME_FRAME,
  "--skill-button-size": SKILL_BUTTON.target,
};

// The palette colours the pause button and the skill discs are drawn in, as 0xrrggbb.
export interface PauseColours {
  readonly cream: number;
  readonly dslate: number;
  readonly ink: number;
  readonly navy: number;
  readonly white: number;
  readonly yellow: number;
}

// One frame of the pause button's art: its tag, and whether it is a press's first, swollen frame.
export interface PauseDiscPose {
  readonly expanded: boolean;
  readonly tag: PauseChromePose;
}

export interface PauseWords {
  readonly card: {
    readonly achievements: string;
    readonly cheats: string;
    readonly close: string;
    readonly home: string;
    readonly resume: string;
    readonly settings: string;
    readonly title: string;
  };
  // The pause button's accessible name.
  readonly button: string;
  // The selected skill's readiness, which its button is described by.
  readonly ready: string;
  readonly recharging: string;
  // Each skill button's accessible name.
  readonly skills: Readonly<Record<SkillId, string>>;
}

export type PauseCardButton = "achievements" | "cheats" | "home" | "resume" | "settings";

export interface PauseCardView {
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<PauseCardButton, HTMLButtonElement>>;
  readonly close: HTMLButtonElement;
  readonly dialog: HTMLElement;
  readonly frame: CardFrame;
  // The action groups, top to bottom: one stack, or two rows of two above the primary.
  readonly groups: readonly ActionsView[];
  readonly root: HTMLElement;
}
export interface SkillButtonView {
  readonly button: HTMLButtonElement;
  readonly disc: SkillDiscView;
}

export interface PauseView {
  // The card in its own wrapper, hidden while the card is closed: the backdrop that takes taps
  // outside the card, and the dialog.
  readonly card: PauseCardView;
  // The skill HUD remains painted while modal cover disables its controls.
  readonly hud: HTMLElement;
  readonly pauseButton: HTMLButtonElement;
  // The descriptions of the selected skill's readiness, by whether it is ready.
  readonly readiness: Readonly<Record<"ready" | "recharging", HTMLElement>>;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
  readonly skills: Readonly<Record<SkillId, SkillButtonView>>;
}

// The view, with the card's dialog identified by id, which its parts' ids extend. Everything
// starts hidden.
export function createPauseView(
  document: Document,
  colours: PauseColours,
  id: string,
  words: PauseWords,
): PauseView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const root = element("div", "pause-scene");
  writeLayoutProperties(PAUSE_LAYOUT, root);
  const frame = createCardFrame(document, {
    className: "pause-card",
    close: words.card.close,
    id,
    title: words.card.title,
    width: "medium",
  });
  const buttons = Object.fromEntries(
    pauseMenuActions(words.card).map(({ key, label, primary }) => [
      key,
      textButton(document, label, primary),
    ]),
  ) as Record<PauseCardButton, HTMLButtonElement>;
  const menu = element("div", "pause-actions");
  const columns = () => menu.hasAttribute("data-columns");
  const groups = [0, 1, 2].map((index) =>
    createActions(document, [], {
      className: "ui-card-actions",
      context: () => (columns() ? (index < 2 ? PAIR : SOLE) : STACK),
      size: () => (columns() && index < 2 ? PAIR_FACE : undefined),
    }),
  );
  menu.append(...groups.map((group) => group.element));
  frame.content.append(menu);
  const card: PauseCardView = {
    backdrop: frame.backdrop,
    buttons,
    close: frame.close!,
    dialog: frame.dialog,
    frame,
    groups,
    root: frame.root,
  };
  card.root.hidden = true;
  const view = element("div", "ui-view pause-hud-view");
  const { element: pauseButton } = createGameButton(
    document,
    { className: "pause-button ui-button-reset" },
    { kind: "icon", name: words.button },
  );
  writeLayoutProperties(PAUSE_LAYOUT, pauseButton);
  pauseButton.tabIndex = -1;
  pauseButton.hidden = true;
  showPauseDisc(colours, { expanded: false, tag: "rest" }, pauseButton);
  const hud = element("div", "skill-hud");
  hud.toggleAttribute(UI_COVERED, true);
  const readiness = {
    ready: element("span", "skill-hud-readiness"),
    recharging: element("span", "skill-hud-readiness"),
  };
  for (const [state, description] of Object.entries(readiness)) {
    description.id = `${id}-skill-${state}`;
    description.hidden = true;
    description.textContent = words[state as keyof typeof readiness];
  }
  const skills = Object.fromEntries(
    SKILL_IDS.map((skill) => {
      const disc = createSkillDisc(document, colours, { ready: false }, undefined);
      const { element: button } = createGameButton(
        document,
        { className: "skill-button ui-button-reset" },
        { icon: disc.element, kind: "icon", name: words.skills[skill] },
      );
      button.tabIndex = -1;
      button.hidden = true;
      button.dataset.skill = skill;
      button.setAttribute("aria-pressed", "false");
      return [skill, { button, disc }];
    }),
  ) as Record<SkillId, SkillButtonView>;
  hud.append(...SKILL_IDS.map((skill) => skills[skill].button), ...Object.values(readiness));
  view.append(pauseButton, hud);
  root.append(card.root, view);
  return {
    card,
    hud,
    pauseButton,
    readiness,
    root,
    skills,
  };
}

// Shows the pause button's art in pose. Each pose is its own SVG, drawn the first time it shows
// and kept, so a pose change never replaces the element a press is on.
export function showPauseDisc(
  colours: PauseColours,
  pose: PauseDiscPose,
  button: HTMLButtonElement,
  mode: "menu" | "pause" = "pause",
): void {
  const key = `${mode}-${pose.tag}${pose.expanded ? "-expanded" : ""}`;
  const poses = [...button.querySelectorAll<SVGSVGElement>(".pause-disc")];
  let shown = poses.find((svg) => svg.dataset.pose === key);
  if (shown === undefined) {
    shown = createNavigationDisc(button.ownerDocument, colours, pose.tag, mode);
    shown.classList.add("pause-disc");
    shown.dataset.pose = key;
    button.append(shown);
  }
  for (const svg of [...poses, shown]) {
    svg.toggleAttribute("data-shown", svg === shown);
  }
}

// The layout properties that place a skill button's target at at, in the base view.
export function skillPlace(at: Point): LayoutValues {
  return { "--skill-x": at.x, "--skill-y": at.y };
}

// How a skill button shows: its place in the base view where shown, its disc's look, and whether
// the keyboard's focus may reach it.
export interface SkillButtonState extends SkillDiscLook {
  readonly at: Point | undefined;
  readonly selected: boolean;
  readonly tabbable: boolean;
}

// Shows a skill button in state: pressed while selected, and the selected one described by its
// readiness.
export function showSkillButton(
  colours: PauseColours,
  readiness: PauseView["readiness"],
  state: SkillButtonState,
  view: SkillButtonView,
): void {
  const { button } = view;
  button.hidden = state.at === undefined;
  if (state.at !== undefined) {
    writeLayoutProperties(skillPlace(state.at), button);
  }
  button.tabIndex = state.tabbable ? 0 : -1;
  button.setAttribute("aria-pressed", String(state.selected));
  if (state.selected) {
    button.setAttribute(
      "aria-describedby",
      (state.ready ? readiness.ready : readiness.recharging).id,
    );
  } else {
    button.removeAttribute("aria-describedby");
  }
  paintSkillDisc(colours, state, view.disc);
}

// The four-action menu is one stack of full-width faces. With Back to title shown, the five
// actions are two rows of two equal faces above the centred primary; the rows are separate
// groups, so each press area reaches half the stacked gap past its face.
const STACK: ActionsContext = { axis: "stack", stackWidth: "fill" };
const HALF_STACK_GAP = { margin: STACK_BUTTON_GAP / 2 } as const;
const PAIR: ActionsContext = { axis: "row", press: HALF_STACK_GAP };
const SOLE: ActionsContext = { press: HALF_STACK_GAP };
const PAIR_FACE = {
  height: TEXT_BUTTON.height,
  width: (cardWidth("medium") - 2 * CARD_CONTENT.padding - BUTTON_GAP) / 2,
} as const;

// Vertical menu actions keep the primary last in both reading and visual order.
export function pauseMenuActions(words: PauseWords["card"]): readonly {
  readonly key: PauseCardButton;
  readonly label: string;
  readonly primary?: boolean;
}[] {
  return [
    { key: "achievements", label: words.achievements },
    { key: "cheats", label: words.cheats },
    { key: "settings", label: words.settings },
    { key: "home", label: words.home },
    { key: "resume", label: words.resume, primary: true },
  ];
}

export function showPauseMenu(
  words: Pick<GameText, "menu" | "pause">,
  mode: "menu" | "pause",
  homeShown: boolean,
  view: PauseView,
): void {
  const { buttons, frame, groups } = view.card;
  frame.frame.setTitle(mode === "pause" ? words.pause.title : words.menu.title);
  setTextButtonLabel(mode === "pause" ? words.pause.resume : words.pause.close, buttons.resume);
  buttons.home.hidden = !homeShown;
  buttons.achievements.hidden = false;
  const { achievements, cheats, home, resume, settings } = buttons;
  const order =
    mode === "pause"
      ? [achievements, settings, cheats, home]
      : [achievements, cheats, settings, home];
  const [first, second, last] = groups.map((group) => group.element) as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];
  first.parentElement!.toggleAttribute("data-columns", homeShown);
  if (homeShown) {
    first.append(...order.slice(0, 2));
    second.append(...order.slice(2));
    last.append(resume);
  } else {
    first.append(...order, resume);
  }
  second.hidden = !homeShown;
  last.hidden = !homeShown;
  groups.forEach((group) => group.arrange());
  frame.layout();
}
