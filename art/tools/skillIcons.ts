/**
 * Native skill glyphs, authored independently of HUD placement and room presentation.
 *
 * Usage: node art/tools/skillIcons.ts build | preview OUT.png, from the repository root.
 * Double-jump, dash and speedy use transparent 16x16 glyphs with two-pixel strokes. Double-jump
 * shows two upward open carets; dash shows three horizontal wind lines without an arrowhead. Both
 * have ready (frame 0, 100ms, cream) and muted (frame 1, 100ms, grey) tags, one static frame per
 * tag. Tags loop and have identical alpha geometry; there is no contact box, nine-slice or third
 * state. The source layers these glyphs over the reused navy UI disc and supplies the 48px touch
 * target. Unlocked skills remain visible, and muted icons still open informational details.
 * Gameplay owns readiness. No HUD coordinates, skill behaviour, input binding, modal or room-card
 * chrome is baked into these glyphs.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";

const KEYS = ["icon-skill-double-jump", "icon-skill-dash", "icon-skill-speedy"] as const;
const ONCE = Object.fromEntries(KEYS.map((key) => [key, []]));
const STATES = [
  ["ready", "cream"],
  ["muted", "grey"],
] as const;
const USAGE = "Usage: skillIcons.ts build | preview OUT.png";

function glyph(colour: string, skill: string): pixel.Frame {
  const g = new pixel.Grid(16, 16);
  if (skill === "double-jump") {
    for (const top of [2, 9]) {
      g.rect(7, top, 2, 2, colour);
      for (let step = 1; step < 5; step++) {
        g.rect(7 - step, top + step, 2, 2, colour);
        g.rect(7 + step, top + step, 2, 2, colour);
      }
    }
  } else if (skill === "speedy") {
    g.rect(9, 2, 3, 4, colour);
    g.rect(8, 5, 3, 4, colour);
    g.rect(7, 8, 3, 3, colour);
    g.rect(9, 9, 4, 3, colour);
    g.rect(12, 10, 3, 2, colour);
    g.rect(6, 11, 9, 2, colour);
    g.rect(1, 3, 5, 2, colour);
    g.rect(0, 7, 5, 2, colour);
  } else {
    for (const [x, y, width] of [
      [3, 3, 10],
      [1, 7, 14],
      [3, 11, 10],
    ] as const) {
      g.rect(x, y, width, 2, colour);
    }
  }
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  for (const skill of ["double-jump", "dash", "speedy"]) {
    yield [
      `icon-skill-${skill}`,
      STATES.map(([state, colour]) => [state, [glyph(colour, skill)], 100] as const),
    ];
  }
}

const OPTIONS: pixel.MainOptions = { grounds: [pixel.hex("navy")], once: ONCE, usage: USAGE };

export function build(): Promise<void> {
  return pixel.build(OPTIONS, [...sprites()]);
}

if (import.meta.main) {
  run(() => pixel.main(OPTIONS, sprites));
}
