// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { SPEAKERS } from "../data/dialogues.ts";
import { TEXT } from "../data/text.ts";
import {
  createDialogueView,
  createStatusPanel,
  dialogueParagraphs,
  showPanelParagraph,
} from "../ui/index.ts";

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
