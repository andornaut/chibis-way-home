// @vitest-environment happy-dom
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { DIALOGUE_PANEL_ALPHA, SPEAKERS } from "../data/dialogues.ts";
import { TEXT } from "../data/text.ts";
import {
  createDialogueView,
  createStatusPanel,
  DIALOGUE_PANEL_LAYOUT,
  dialogueParagraphs,
  showPanelParagraph,
} from "../ui/index.ts";
import { DIALOGUE_PANEL_KEY } from "./dialoguePanel.ts";

const SOURCES = import.meta.glob<string>(["../**/*.ts", "!../**/*.test.ts"], {
  eager: true,
  import: "default",
  query: "?raw",
});
// Vitest blanks CSS imports, so the stylesheet is read from disk, from the project root.
const DIALOGUE_CSS = readFileSync("src/ui/dom/dialogue.css", "utf8");

// The scenes that show a conversation, bark or achievement notice panel in the HTML UI, and the
// room, whose gift panel the canvas still draws.
const DOM_PANEL_SCENES = [
  "./AchievementNoticeScene.ts",
  "./DialogueScene.ts",
  "./ZoneBarkScene.ts",
];
const CANVAS_PANEL_SCENES = ["./RoomScene.ts"];

const speakerParagraph = (speaker: string) =>
  dialogueParagraphs(SPEAKERS, TEXT, {
    lines: [{ line: Object.keys(TEXT.lines)[0]!, speaker }],
  })[0]!;

it("shows each speaker's paragraph at their end, their name in their colour as the heading", () => {
  const view = createDialogueView(document, false, "dialogue", TEXT.dialogue);
  for (const speaker of Object.keys(SPEAKERS)) {
    const paragraph = speakerParagraph(speaker);
    showPanelParagraph(view.panel, paragraph);
    expect(
      {
        colour: view.panel.tab.dataset.colour,
        heading: view.panel.tab.tagName,
        line: view.panel.line.textContent,
        name: view.panel.tab.textContent,
        side: view.panel.element.dataset.side,
        tab: view.panel.tab.hidden,
      },
      speaker,
    ).toEqual({
      colour: SPEAKERS[speaker]!.colour,
      heading: "H2",
      line: paragraph.text,
      name: TEXT.dialogue.speakers[speaker],
      side: SPEAKERS[speaker]!.side,
      tab: false,
    });
  }
  expect({
    label: view.dialog.getAttribute("aria-label"),
    live: view.panel.line.getAttribute("aria-live"),
    portrait: view.panel.portrait.alt,
    role: view.dialog.getAttribute("role"),
  }).toEqual({ label: TEXT.dialogue.label, live: "polite", portrait: "", role: "dialog" });
});

it("shows a heading in place of a name tab, in a polite status region", () => {
  const { panel, root } = createStatusPanel(document, "notice");
  showPanelParagraph(panel, { heading: "Unlocked", name: null, side: "left", text: "Words" });
  expect({
    heading: [panel.heading.hidden, panel.heading.textContent],
    line: panel.line.textContent,
    status: root.querySelector("[role=status]")?.contains(panel.element),
    tab: panel.tab.hidden,
  }).toEqual({ heading: [false, "Unlocked"], line: "Words", status: true, tab: true });
});

it("draws only the box at the shared translucent alpha", () => {
  expect(DIALOGUE_PANEL_LAYOUT["--dialogue-alpha"]).toBe(DIALOGUE_PANEL_ALPHA);
  expect(DIALOGUE_PANEL_ALPHA).toBeLessThan(1);
  const rules = [...DIALOGUE_CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)];
  const translucent = rules.filter(([, , body]) => body!.includes("opacity"));
  expect(translucent.map(([, selector, body]) => [selector!.trim(), body!.trim()])).toEqual([
    [".dialogue-box", expect.stringContaining("opacity: var(--dialogue-alpha);")],
  ]);
});

it("shows every dialogue panel only through the shared views", () => {
  const owners = ["./dialoguePanel.ts", "../ui/dom/dialogue.ts", "../ui/dom/skin.ts"];
  for (const [path, source] of Object.entries(SOURCES)) {
    if (!owners.includes(path)) {
      expect(source, path).not.toContain(DIALOGUE_PANEL_KEY);
    }
    if (!["../data/dialogues.ts", "../ui/dom/dialogue.ts", "./dialoguePanel.ts"].includes(path)) {
      expect(source, path).not.toContain("DIALOGUE_PANEL_ALPHA");
    }
  }
  for (const path of DOM_PANEL_SCENES) {
    expect(SOURCES[path], path).toMatch(/create(DialogueView|StatusPanel)\(/);
    expect(SOURCES[path], path).not.toContain("drawDialoguePanel");
  }
  for (const path of CANVAS_PANEL_SCENES) {
    expect(SOURCES[path], path).toContain("drawDialoguePanel(this)");
    expect(SOURCES[path], path).toContain("drawDialogueParagraph(this");
  }
});
