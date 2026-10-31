import { rampDown } from "@andornaut/game-kit/rgba";

// Art's palette (public/art/palette.json): named colours, single ramp steps and the title
// screen's separate two-step ambient treatment.
export interface Palette {
  readonly darker: Readonly<Record<string, string>>;
  readonly colours: Readonly<Record<string, string>>;
  readonly dim2: Readonly<Record<string, string>>;
}

function rgb(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

// Maps a colour (0xRRGGBB) two steps down its ramp (dim2 is two steps in one), after snapping it
// to the nearest palette colour, so a colour off the palette still lands on a ramp. Never blends
// with black.
export function dimColour(palette: Palette): (colour: number) => number {
  const twoSteps = new Map(Object.entries(palette.dim2).map(([from, to]) => [rgb(from), rgb(to)]));
  return rampDown(twoSteps, 1);
}
