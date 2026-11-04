import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json";
import type { ControlAction } from "../../data/types";
import { ACTION_HELP } from "../layout/actionHelp";
import { helpChromeLayers, helpChromeSvg } from "./helpChrome";
import { touchChromeLayers, touchChromePixel } from "./touchChrome";

const colours = {
  cream: parseInt(palette.colours.cream.slice(1), 16),
  ink: parseInt(palette.colours.ink.slice(1), 16),
  navy: parseInt(palette.colours.navy.slice(1), 16),
  white: parseInt(palette.colours.white.slice(1), 16),
};
it.each<ControlAction>(["move", "use", "jump"])(
  "fills %s help on navy without filling the live control",
  (action) => {
    const face = { x: 37.5, y: 51 };
    const pixel = touchChromePixel(helpChromeLayers(colours, action), face);
    expect(pixel).toEqual([
      (colours.navy >> 16) & 255,
      (colours.navy >> 8) & 255,
      colours.navy & 255,
      255,
    ]);
    expect(touchChromePixel(touchChromeLayers(colours, action, "rest", false), face)[3]).toBe(0);
    const edge = touchChromePixel(helpChromeLayers(colours, action), { x: 63.375, y: 63.375 })[3];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(touchChromePixel(helpChromeLayers(colours, action), { x: 0.125, y: 0.125 })[3]).toBe(0);
    const svg = helpChromeSvg(colours, ACTION_HELP.icon, action);
    expect(svg).toContain('viewBox="0 0 75 75"');
    expect(svg).toContain(`width="${ACTION_HELP.icon}" height="${ACTION_HELP.icon}"`);
    expect(svg).toContain(`fill="${palette.colours.navy}"`);
    expect(svg).not.toMatch(/style=|data:|<image|onclick/iu);
  },
);
