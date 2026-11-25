// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { DEV_TEXT } from "../../data/dev.ts";
import { TEXT } from "../../data/text.ts";
import type { SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { createPauseView, showPauseDisc, showSkillButton } from "./pause.ts";

const colour = (key: keyof typeof palette.colours) => parseInt(palette.colours[key].slice(1), 16);
const COLOURS = {
  cream: colour("cream"),
  dslate: colour("dslate"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
  yellow: colour("yellow"),
};

function mount() {
  const view = createPauseView(document, COLOURS, "pause-card", {
    button: TEXT.pause.button,
    card: { ...TEXT.pause, achievements: TEXT.start.achievements, cheats: DEV_TEXT.openCheats },
    ready: TEXT.skillHud.ready,
    recharging: TEXT.skillHud.recharging,
    skills: Object.fromEntries(
      SKILL_IDS.map((skill) => [skill, TEXT.skills[skill].title]),
    ) as Record<SkillId, string>,
  });
  document.body.append(view.root);
  return view;
}

// What a skill button is described by, as assistive technology reads it.
const description = (button: HTMLElement) => {
  const id = button.getAttribute("aria-describedby");
  return id === null ? undefined : document.getElementById(id)?.textContent;
};

afterEach(() => document.body.replaceChildren());

it("names the entry and each skill from the game's text, one button each, hidden until shown", () => {
  const view = mount();
  const discs = [view.pauseButton, ...SKILL_IDS.map((skill) => view.skills[skill].button)];
  expect(discs.map((disc) => [disc.tagName, disc.type, disc.getAttribute("aria-label")])).toEqual([
    ["BUTTON", "button", TEXT.pause.button],
    ...SKILL_IDS.map((skill) => ["BUTTON", "button", TEXT.skills[skill].title]),
  ]);
  expect(discs.map((disc) => [disc.hidden, disc.tabIndex])).toEqual(discs.map(() => [true, -1]));
  // Art inside a disc adds no name of its own.
  for (const disc of discs) {
    expect(
      [...disc.querySelectorAll("svg, img")].every((art) => art.closest("[aria-hidden='true']")),
    ).toBe(true);
  }
});

it("keeps the entry alone in its group and the skills together in theirs, in focus order", () => {
  const view = mount();
  const skills = SKILL_IDS.map((skill) => view.skills[skill].button);
  expect([...view.entry.querySelectorAll("button")]).toEqual([view.pauseButton]);
  expect([...view.hud.querySelectorAll("button")]).toEqual(skills);
  expect(skills.map((button) => button.dataset.skill)).toEqual([...SKILL_IDS]);
  const hud = view.entry.parentElement!;
  expect([...hud.querySelectorAll("button")]).toEqual([view.pauseButton, ...skills]);
});

it("shows the selected skill pressed and described by its readiness, and the others not", () => {
  const view = mount();
  const [selected, other] = SKILL_IDS as readonly [SkillId, SkillId];
  const show = (skill: SkillId, state: { ready: boolean; selected: boolean; shown: boolean }) =>
    showSkillButton(view.readiness, { ...state, tabbable: true }, view.skills[skill]);
  show(selected, { ready: true, selected: true, shown: true });
  show(other, { ready: false, selected: false, shown: true });
  const state = (skill: SkillId) => {
    const { button } = view.skills[skill];
    return {
      described: description(button),
      hidden: button.hidden,
      pressed: button.getAttribute("aria-pressed"),
      tabIndex: button.tabIndex,
    };
  };
  expect(state(selected)).toEqual({
    described: TEXT.skillHud.ready,
    hidden: false,
    pressed: "true",
    tabIndex: 0,
  });
  expect(state(other)).toEqual({
    described: undefined,
    hidden: false,
    pressed: "false",
    tabIndex: 0,
  });
  show(selected, { ready: false, selected: true, shown: true });
  expect(state(selected).described).toBe(TEXT.skillHud.recharging);
  show(selected, { ready: false, selected: false, shown: false });
  expect(state(selected)).toMatchObject({ described: undefined, hidden: true, pressed: "false" });
});

it("marks a skill's disc ready and changes the entry's pose without replacing either button", () => {
  const view = mount();
  const [skill] = SKILL_IDS as readonly [SkillId];
  const { button, glyph } = view.skills[skill];
  const look = { selected: true, shown: true, tabbable: false };
  showSkillButton(view.readiness, { ...look, ready: false }, view.skills[skill]);
  expect(button.hasAttribute("data-ready")).toBe(false);
  showSkillButton(view.readiness, { ...look, ready: true }, view.skills[skill]);
  expect(button.hasAttribute("data-ready")).toBe(true);
  // The kit's fill layer draws the disc; the button holds only its glyph.
  expect(button.querySelector("svg")).toBeNull();
  expect([view.skills[skill].button, button.contains(glyph)]).toEqual([button, true]);

  const entry = view.pauseButton;
  const shown = () => [...entry.querySelectorAll<SVGElement>("svg[data-shown]")];
  const rest = shown();
  expect(rest).toHaveLength(1);
  showPauseDisc(COLOURS, { expanded: true, tag: "press" }, entry);
  expect(shown()).toHaveLength(1);
  expect(shown()).not.toEqual(rest);
  showPauseDisc(COLOURS, { expanded: false, tag: "rest" }, entry);
  // Each pose keeps its own art, so a pose shown again is the same element.
  expect(shown()).toEqual(rest);
  expect(view.entry.contains(entry)).toBe(true);
});
