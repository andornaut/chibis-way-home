/**
 * Trixi and Kiwi dialogue portraits matching their existing antagonist identities, Mallow the
 * mouse parcel clerk, and the Tip speaker's light bulb.
 *
 * Usage: node art/tools/speakerPortraits.ts build | preview OUT.png, from the repository root.
 * portrait-goose, portrait-mallow, portrait-raccoon and portrait-tip: 48x48, transparent ground,
 * cropped at the bottom and one ink outer contour. Mallow has one idle frame; the others have one
 * neutral frame. All loop at 1000ms, once []. Use the
 * standard unmirrored dialogue portrait slot with its top-left origin. No portrait declares a
 * hitbox, contact mask or slice. Trixi and Kiwi face right and are cropped at the chest. Trixi
 * retains cream feathers, a long neck, grey wing, orange bill and round ink-rimmed glasses: one lens
 * over a white eye and ink pupil, sized within the head. Kiwi retains rounded ears, grey/slate fur,
 * paired ink masks, a cream face band and muzzle, and white eye glints, without accessories. Tip is
 * an upright light bulb without a face: warm yellow glass shaded by an amber crescent along its
 * lower right, white glints at the upper left, four short yellow rays clear of the glass and a grey
 * screw base whose thread bands run off the bottom edge. Mallow faces left with separated round
 * ears, grey fur, a tapered cream muzzle and a small collar and clerk badge on the cropped chest.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const ONCE = {
  "portrait-goose": [],
  "portrait-mallow": [],
  "portrait-raccoon": [],
  "portrait-tip": [],
};
const USAGE = "Usage: speakerPortraits.ts build | preview OUT.png";

function goose(): pixel.Frame {
  const g = new Grid(48, 48);
  g.blob(16, 52, 19.5, 16.5, "cream", "lgrey", "white");
  g.ell(10.5, 49, 12, 10.5, "grey", "dslate", "lgrey");
  g.ell(21, 39, 7.5, 16.5, "cream", "lgrey", "white");
  g.ell(25.5, 26, 6, 13, "cream", "lgrey", "white");
  g.blob(28, 17, 11, 10, "cream", "lgrey", "white");
  // A tapered bill with a raised base, a nostril and an ochre lower edge.
  g.tri([36, 15], [46, 21], [35, 24], "orange");
  g.rect(36, 22, 9, 2, "ochre");
  g.rect(40, 18, 2, 1, "ochre");
  // One round lens inside the head over a visible eye; a short bridge and the temple to the crown.
  g.rect(18, 15, 8, 1, "ink");
  g.ell(30, 15.5, 4.5, 4.5, "ink");
  g.ell(30, 15.5, 3, 3, "white");
  g.rect(31, 14, 2, 3, "ink");
  g.p(28, 13, "lgrey");
  g.rect(34, 14, 3, 1, "ink");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

/** A friendly three-quarter mouse profile, with the ears clear above the head. */
function mallow(): pixel.Frame {
  const g = new Grid(48, 48);
  g.blob(27, 54, 18, 18, "grey", "slate", "lgrey");
  // A low clerk's bib and cream collar keep the face and ears as the focal point.
  g.ell(28, 52, 13, 11, "dslate");
  g.tri([18, 39], [27, 42], [22, 46], "cream");
  g.tri([27, 42], [36, 38], [32, 46], "cream");
  g.rect(34, 44, 4, 3, "cream");
  // Separate round ears, with warm inner cups rather than a raccoon's dark ear centres.
  g.blob(14, 12, 8, 9, "grey", "slate", "lgrey");
  g.ell(14, 12, 5, 6, "cream", "skin1");
  g.blob(35, 11, 9, 10, "grey", "slate", "lgrey");
  g.ell(35, 11, 6, 7, "cream", "skin1");
  g.blob(26, 28, 16, 14, "grey", "slate", "lgrey");
  // The muzzle narrows towards the left nose, away from the round cheek.
  g.tri([21, 26], [6, 31], [19, 38], "cream");
  g.ell(19, 33, 8, 5, "cream", "skin1");
  g.rect(5, 30, 3, 2, "ink");
  g.ell(19, 25, 3, 3, "ink");
  g.rect(18, 23, 2, 2, "white");
  g.rect(13, 34, 5, 1, "ink");
  // Two clean whisker clusters on the near cheek.
  g.rect(7, 27, 5, 1, "ink");
  g.rect(6, 35, 5, 1, "ink");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

function raccoon(): pixel.Frame {
  const g = new Grid(48, 48);
  g.blob(22.5, 53, 19, 19.5, "grey", "slate", "lgrey");
  g.ell(26, 51, 11, 16.5, "cream", "lgrey");
  for (const x of [13, 36]) {
    g.ell(x, 9, 6, 6, "grey", "slate", "lgrey");
    g.ell(x, 9, 3, 3, "ink");
  }
  g.blob(25, 22.5, 17, 15, "grey", "slate", "lgrey");
  g.ell(26, 28, 16.5, 8, "cream", "lgrey");
  g.rect(22, 9, 4, 10, "slate");
  for (const [x, y] of [
    [17, 23],
    [33, 22],
  ] as const) {
    g.ell(x, y, 6, 4.5, "ink");
    g.rect(x - 2, y - 2, 2, 2, "white");
  }
  g.ell(31, 32, 10, 6, "cream", "lgrey");
  g.rect(32, 27, 4, 2, "ink");
  g.rect(31, 34, 4, 1, "slate");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

/** The glass silhouette: a round globe tapering into a neck that meets the base. */
function glass(g: Grid, dx: number, dy: number, colour: string): void {
  g.ell(24 + dx, 16 + dy, 13.5, 13.5, colour);
  g.tri([12 + dx, 20 + dy], [36 + dx, 20 + dy], [31 + dx, 33 + dy], colour);
  g.tri([12 + dx, 20 + dy], [31 + dx, 33 + dy], [17 + dx, 33 + dy], colour);
}

function tip(): pixel.Frame {
  const g = new Grid(48, 48);
  // Amber shade where the glass drawn 3px up and to the left does not reach: a lower-right crescent.
  const lit = new Grid(48, 48);
  glass(lit, -3, -3, "yellow");
  glass(g, 0, 0, "amber");
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      if (g.px[y]?.[x] && lit.px[y]?.[x]) {
        g.p(x, y, "yellow");
      }
    }
  }
  // White glints: a curved streak along the upper left of the globe and a short dot below it.
  g.rect(14, 10, 2, 5, "white");
  g.rect(15, 8, 2, 2, "white");
  g.rect(17, 6, 3, 2, "white");
  g.rect(14, 17, 2, 2, "white");
  // Screw base: a collar, then 3px threads stepping out past 2px grooves, cropped by the bottom edge.
  g.rect(17, 32, 15, 2, "grey");
  for (const y of [34, 39, 44]) {
    g.rect(16, y, 17, 3, "grey");
    g.rect(16, y, 2, 3, "lgrey");
    g.rect(29, y, 4, 3, "slate");
  }
  for (const y of [37, 42, 47]) {
    g.rect(18, y, 13, 2, "slate");
    g.rect(27, y, 4, 2, "dslate");
  }
  g.rect(28, 32, 4, 2, "slate");
  // Short rays clear of the glass: level at each side and rising at the upper corners.
  for (const x of [2, 42]) {
    g.rect(x, 15, 4, 2, "yellow");
  }
  for (let i = 0; i < 3; i++) {
    g.rect(8 - i, 6 - i, 2, 1, "yellow");
    g.rect(38 + i, 6 - i, 2, 1, "yellow");
  }
  return g.outlined({ edge: () => pixel.hex("ink") });
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield ["portrait-goose", [["neutral", [goose()], 1000]]];
  yield ["portrait-mallow", [["idle", [mallow()], 1000]]];
  yield ["portrait-raccoon", [["neutral", [raccoon()], 1000]]];
  yield ["portrait-tip", [["neutral", [tip()], 1000]]];
}

const OPTIONS: pixel.MainOptions = {
  grounds: [pixel.hex("dslate"), pixel.hex("lgrey")],
  once: ONCE,
  usage: USAGE,
};

export function build(): Promise<void> {
  return pixel.build(OPTIONS, [...sprites()]);
}

if (import.meta.main) {
  run(() => pixel.main(OPTIONS, sprites));
}
