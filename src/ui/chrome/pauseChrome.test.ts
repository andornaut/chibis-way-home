// @vitest-environment happy-dom
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { DEV_TEXT } from "../../data/dev.ts";
import { TEXT } from "../../data/text.ts";
import type { SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { svgLayers } from "../../testing/chromeSvg.ts";
import { createNavigationDisc } from "../dom/navigationDisc.ts";
import { createPauseView, showPauseDisc } from "../dom/pause.ts";
import { PAUSE_DISC, PAUSE_VISIBLE_DIAMETER } from "../layout/controlChrome.ts";
import { PAUSE_CHROME_FRAME, pauseChromeLayers, type PauseChromePose } from "./pauseChrome.ts";

const colour = (key: keyof typeof palette.colours) => parseInt(palette.colours[key].slice(1), 16);
const colours = {
  cream: colour("cream"),
  dslate: colour("dslate"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
  yellow: colour("yellow"),
};

// The entry disc of a pause view, whose face art holds the poses.
const entryButton = () =>
  createPauseView(document, colours, "pause-card", {
    button: TEXT.pause.button,
    card: { ...TEXT.pause, achievements: TEXT.start.achievements, cheats: DEV_TEXT.openCheats },
    ready: TEXT.skillHud.ready,
    recharging: TEXT.skillHud.recharging,
    skills: Object.fromEntries(
      SKILL_IDS.map((skill) => [skill, TEXT.skills[skill].title]),
    ) as Record<SkillId, string>,
  }).pauseButton;

it.each<{ pose: PauseChromePose; expanded: boolean; core: string }>([
  { core: "cream", expanded: false, pose: "rest" },
  { core: "white", expanded: true, pose: "press" },
  { core: "white", expanded: false, pose: "press" },
  { core: "white", expanded: false, pose: "held" },
])(
  "shows the $pose pose as glyph-only HUD disc art as inline SVG in its frame, painted by name",
  ({ core, expanded, pose }) => {
    const button = entryButton();
    showPauseDisc(colours, { expanded, tag: pose }, button);
    const svg = button.querySelector<SVGSVGElement>("svg[data-shown]")!;
    expect({
      active: button.hasAttribute("data-navigation-active"),
      layers: svgLayers(svg),
      paints: [...svg.children].map((shape) => shape.getAttribute("data-ui-fill")),
      viewBox: svg.getAttribute("viewBox"),
    }).toEqual({
      active: pose !== "rest",
      layers: pauseChromeLayers(colours, pose),
      paints: [core, core],
      viewBox: `0 0 ${PAUSE_CHROME_FRAME} ${PAUSE_CHROME_FRAME}`,
    });
    showPauseDisc(colours, { expanded: false, tag: "rest" }, button);
    showPauseDisc(colours, { expanded, tag: pose }, button);
    // Each pose keeps its SVG, so showing one again replaces nothing.
    expect(button.querySelector("svg[data-shown]")).toBe(svg);
    expect(button.querySelectorAll("svg[data-shown]")).toHaveLength(1);
  },
);

it("preserves the glyph rectangles and the existing frame and visible diameter", () => {
  expect(PAUSE_DISC).toEqual({ frame: 35, inset: 1, restDiameter: 33 });
  expect(PAUSE_CHROME_FRAME).toBe(PAUSE_DISC.frame);
  expect(PAUSE_VISIBLE_DIAMETER).toBe(PAUSE_DISC.restDiameter);
  expect(pauseChromeLayers(colours, "rest")).toEqual([
    { colour: colours.cream, kind: "rect", rect: { height: 13, width: 4, x: 12, y: 11 } },
    { colour: colours.cream, kind: "rect", rect: { height: 13, width: 4, x: 19, y: 11 } },
  ]);
});

it("uses the shared three-bar menu glyph without changing the Pause poses or button geometry", () => {
  const button = entryButton();
  showPauseDisc(colours, { expanded: false, tag: "rest" }, button, "menu");
  const menu = svgLayers(button.querySelector("svg[data-shown]")!);
  expect(menu).toEqual([
    { colour: colours.cream, kind: "rect", rect: { height: 3, width: 11, x: 12, y: 11 } },
    { colour: colours.cream, kind: "rect", rect: { height: 3, width: 11, x: 12, y: 16 } },
    { colour: colours.cream, kind: "rect", rect: { height: 3, width: 11, x: 12, y: 21 } },
  ]);
  showPauseDisc(colours, { expanded: false, tag: "rest" }, button, "pause");
  expect(svgLayers(button.querySelector("svg[data-shown]")!)).toEqual(
    pauseChromeLayers(colours, "rest"),
  );
});

it("draws only Exit's door glyph", () => {
  const svg = createNavigationDisc(document, colours, "rest", "exit");
  expect(svg.querySelector("path")?.getAttribute("transform")).toBe("translate(8.6 7.5)");
  expect(svg.children).toHaveLength(1);
});
