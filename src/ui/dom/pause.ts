import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import type { GameText, Point, SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { PAUSE_CHROME_FRAME, type PauseChromePose } from "../chrome/pauseChrome.ts";
import { createGameButton } from "../input/actionBinding.ts";
import { PAUSE_BUTTON } from "../layout/pauseCard.ts";
import { SKILL_BUTTON } from "../layout/skillHud.ts";
import { type CardView, type CardWords, createCard } from "./card.ts";
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

export interface SkillButtonView {
  readonly button: HTMLButtonElement;
  readonly disc: SkillDiscView;
}

export interface PauseView {
  readonly actionsScroll: HTMLElement;
  // The card in its own wrapper, hidden while the card is closed: the backdrop that takes taps
  // outside the card, and the dialog.
  readonly card: CardView<PauseCardButton> & { readonly close: HTMLButtonElement };
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
  const card = createCard<PauseCardButton>(document, id, {
    actions: pauseMenuActions(words.card),
    actionsLayout: "stack",
    close: words.card.close,
    title: words.card.title,
    width: "medium",
  });
  const close = card.close!;
  const actionsScroll = card.buttons.resume.parentElement!;
  actionsScroll.classList.add("ui-card-scroll", "pause-actions-scroll");
  const footer = element("div", "ui-card-actions ui-control-group ui-button-stack");
  footer.dataset.uiAxis = "stack";
  footer.append(card.buttons.resume);
  actionsScroll.after(footer);
  card.dialog.classList.add("pause-card");
  // The close X wraps after the card actions in keyboard focus.
  card.dialog.prepend(close);
  card.root.hidden = true;
  const view = element("div", "ui-view pause-hud-view");
  const { element: pauseButton } = createGameButton(
    document,
    { className: "pause-button" },
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
        { className: "skill-button" },
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
    actionsScroll,
    card: { ...card, close },
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

// Vertical menu actions keep the primary last in both reading and visual order.
export function pauseMenuActions(words: PauseWords["card"]): CardWords<PauseCardButton>["actions"] {
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
  view.card.dialog.querySelector(".ui-card-title")!.textContent =
    mode === "pause" ? words.pause.title : words.menu.title;
  view.card.buttons.resume.querySelector(".ui-text-button-label")!.textContent =
    mode === "pause" ? words.pause.resume : words.pause.close;
  view.card.buttons.home.hidden = !homeShown;
  view.card.buttons.achievements.hidden = false;
}
