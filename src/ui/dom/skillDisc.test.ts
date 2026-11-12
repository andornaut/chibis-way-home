// @vitest-environment happy-dom
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { svgLayers } from "../../testing/chromeSvg.ts";
import { skillChromeLayers } from "../chrome/skillChrome.ts";
import { SKILL_BUTTON } from "../layout/skillHud.ts";
import { createSkillDisc, paintSkillDisc } from "./skillDisc.ts";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);
const COLOURS = { ink: colour("ink"), navy: colour("navy"), yellow: colour("yellow") };
const LOOKS = [false, true].flatMap((ready) =>
  [false, true].map((selected) => ({ ready, selected })),
);

// The disc's layers for look: a yellow face while ready, a navy one otherwise.
const layersFor = ({ ready, selected }: (typeof LOOKS)[number]) =>
  skillChromeLayers({ face: ready ? COLOURS.yellow : COLOURS.navy, ink: COLOURS.ink }, selected);

it.each(LOOKS)(
  "draws the skill chrome's layers in the button's target, ready $ready and selected $selected, named as one image",
  (look) => {
    const { element, glyph } = createSkillDisc(document, COLOURS, look, "Dash skill");
    const svg = element.querySelector("svg")!;
    expect({
      glyph: [glyph.alt, glyph.hasAttribute("src")],
      hidden: svg.getAttribute("aria-hidden"),
      layers: svgLayers(svg),
      name: [element.getAttribute("role"), element.getAttribute("aria-label")],
      paints: [...svg.children].map((shape) => shape.getAttribute("data-ui-fill")),
      viewBox: svg.getAttribute("viewBox"),
    }).toEqual({
      glyph: ["", false],
      hidden: "true",
      layers: layersFor(look),
      name: ["img", "Dash skill"],
      paints: look.selected
        ? ["ink", look.ready ? "yellow" : "navy"]
        : [look.ready ? "yellow" : "navy"],
      viewBox: `0 0 ${SKILL_BUTTON.target} ${SKILL_BUTTON.target}`,
    });
    expect(element.style.getPropertyValue("--skill-disc-target")).toBe(String(SKILL_BUTTON.target));
    expect(element.style.getPropertyValue("--skill-disc-glyph")).toBe(String(SKILL_BUTTON.glyph));
  },
);

it("leaves an unnamed disc to the control it is in, and repaints it for a new look", () => {
  const view = createSkillDisc(document, COLOURS, LOOKS[0]!, undefined);
  expect([view.element.getAttribute("aria-hidden"), view.element.hasAttribute("role")]).toEqual([
    "true",
    false,
  ]);
  for (const look of LOOKS) {
    paintSkillDisc(COLOURS, look, view);
    expect(view.element.querySelectorAll("svg")).toHaveLength(1);
    expect(svgLayers(view.element.querySelector("svg")!)).toEqual(layersFor(look));
  }
});
