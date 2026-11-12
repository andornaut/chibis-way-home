// @vitest-environment happy-dom
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { TEXT } from "../../data/text.ts";
import type { ControlAction } from "../../data/types/index.ts";
import { svgLayers } from "../../testing/chromeSvg.ts";
import { helpChromeLayers } from "../chrome/helpChrome.ts";
import { TOUCH_CHROME_FRAME } from "../chrome/touchChrome.ts";
import { createActionHelp } from "./actionHelp.ts";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);
const COLOURS = {
  cream: colour("cream"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
};
const WORDS = { actions: TEXT.buttons, icons: TEXT.actionIcons };

it.each<ControlAction>(["jump", "move", "use"])(
  "draws the %s help illustration from its chrome layers after its label, named from data",
  (action) => {
    const paragraph = document.createElement("p");
    paragraph.append(...createActionHelp(document, COLOURS, WORDS, `Press {${action}} now.`));
    const unit = paragraph.querySelector(".ui-action-help-action")!;
    const icon = unit.querySelector("[role=img]")!;
    const svg = icon.querySelector("svg")!;
    expect({
      layers: svgLayers(svg),
      name: icon.getAttribute("aria-label"),
      parts: [...unit.children].map((child) => child.className),
      text: paragraph.textContent,
      viewBox: svg.getAttribute("viewBox"),
    }).toEqual({
      layers: helpChromeLayers(COLOURS, action),
      name: TEXT.actionIcons[action],
      parts: ["ui-action-help-label", "ui-action-help-icon"],
      text: `Press ${TEXT.buttons[action]} now.`,
      viewBox: `0 0 ${TOUCH_CHROME_FRAME} ${TOUCH_CHROME_FRAME}`,
    });
  },
);

it("keeps the text between tokens as plain text, never markup", () => {
  const nodes = createActionHelp(document, COLOURS, WORDS, "<b>{use}</b>");
  expect(nodes.map((node) => node.nodeType)).toEqual([
    Node.TEXT_NODE,
    Node.ELEMENT_NODE,
    Node.TEXT_NODE,
  ]);
  expect(nodes[0]!.textContent).toBe("<b>");
});
