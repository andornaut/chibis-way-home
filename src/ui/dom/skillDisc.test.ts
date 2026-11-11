// @vitest-environment happy-dom
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json";
import { svgLayers } from "../../testing/chromeSvg";
import { skillChromeLayers } from "../chrome/skillChrome";
import { SKILL_BUTTON } from "../layout/skillHud";
import { createSkillDisc } from "./skillDisc";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);
const COLOURS = { face: colour("yellow"), ink: colour("ink") };

it.each([false, true])(
  "draws the skill chrome's layers in the button's target, selected %s, named as one image",
  (selected) => {
    const { element, glyph } = createSkillDisc(document, COLOURS, selected, "Dash skill");
    const svg = element.querySelector("svg")!;
    expect({
      glyph: [glyph.alt, glyph.hasAttribute("src")],
      hidden: svg.getAttribute("aria-hidden"),
      layers: svgLayers(svg),
      name: [element.getAttribute("role"), element.getAttribute("aria-label")],
      viewBox: svg.getAttribute("viewBox"),
    }).toEqual({
      glyph: ["", false],
      hidden: "true",
      layers: skillChromeLayers(COLOURS, selected),
      name: ["img", "Dash skill"],
      viewBox: `0 0 ${SKILL_BUTTON.target} ${SKILL_BUTTON.target}`,
    });
    expect(element.style.getPropertyValue("--skill-disc-target")).toBe(String(SKILL_BUTTON.target));
    expect(element.style.getPropertyValue("--skill-disc-glyph")).toBe(String(SKILL_BUTTON.glyph));
  },
);
