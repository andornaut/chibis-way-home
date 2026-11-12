// @vitest-environment happy-dom
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json";
import { svgLayers } from "../../testing/chromeSvg";
import { showPauseDisc } from "../dom/pause";
import { PAUSE_BUTTON } from "../layout/pauseCard";
import { PAUSE_CHROME_FRAME, pauseChromeLayers, type PauseChromePose } from "./pauseChrome";

const colour = (key: keyof typeof palette.colours) => parseInt(palette.colours[key].slice(1), 16);
const colours = {
  cream: colour("cream"),
  dslate: colour("dslate"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
  yellow: colour("yellow"),
};

it.each<{ pose: PauseChromePose; expanded: boolean; face: string; core: string }>([
  { core: "cream", expanded: false, face: "navy", pose: "rest" },
  { core: "white", expanded: true, face: "dslate", pose: "press" },
  { core: "white", expanded: false, face: "dslate", pose: "press" },
  { core: "white", expanded: false, face: "dslate", pose: "held" },
])(
  "shows the $pose pose as inline SVG in its frame, painted in palette colours by name",
  ({ core, expanded, face, pose }) => {
    const button = document.createElement("button");
    showPauseDisc(colours, { expanded, tag: pose }, button);
    const svg = button.querySelector<SVGSVGElement>("svg[data-shown]")!;
    expect({
      layers: svgLayers(svg),
      paints: [...svg.children].map((shape) => shape.getAttribute("data-ui-fill")),
      viewBox: svg.getAttribute("viewBox"),
    }).toEqual({
      layers: pauseChromeLayers(colours, pose, expanded),
      paints: ["ink", core, face, core, core],
      viewBox: `0 0 ${PAUSE_CHROME_FRAME} ${PAUSE_CHROME_FRAME}`,
    });
    showPauseDisc(colours, { expanded: false, tag: "rest" }, button);
    showPauseDisc(colours, { expanded, tag: pose }, button);
    // Each pose keeps its SVG, so showing one again replaces nothing.
    expect(button.querySelector("svg[data-shown]")).toBe(svg);
    expect(button.querySelectorAll("svg[data-shown]")).toHaveLength(1);
  },
);

it("retains the existing 52.5px Pause target", () => {
  expect(PAUSE_BUTTON.hit.width).toBe(52.5);
  expect(PAUSE_BUTTON.hit.height).toBe(52.5);
});

it("keeps the 35px disc, 1px ring and two 4x13 bars, swelling by 1px on a press's first frame", () => {
  const centre = { x: 17.5, y: 17.5 };
  expect(PAUSE_CHROME_FRAME).toBe(35);
  expect(pauseChromeLayers(colours, "rest", false)).toEqual([
    { centre, colour: colours.ink, kind: "disc", radius: 16.5 },
    { centre, colour: colours.cream, kind: "disc", radius: 15.5 },
    { centre, colour: colours.navy, kind: "disc", radius: 13.5 },
    { colour: colours.cream, kind: "rect", rect: { height: 13, width: 4, x: 12, y: 11 } },
    { colour: colours.cream, kind: "rect", rect: { height: 13, width: 4, x: 19, y: 11 } },
  ]);
  const radii = (expanded: boolean) =>
    pauseChromeLayers(colours, "press", expanded).flatMap((layer) =>
      layer.kind === "disc" ? [layer.radius] : [],
    );
  expect(radii(true)).toEqual([17.5, 16.5, 13.5]);
  expect(radii(false)).toEqual([16.5, 15.5, 12.5]);
});
