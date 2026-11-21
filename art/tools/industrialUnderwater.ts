/** Opaque industrial pressure window, 48x240, bottom-left at y600, repeat x.
 * The interior plane also tiles vertically, so the pressure frame joins on both axes.
 * Water, plants and suspended particles are scenery behind the glass.
 */
import { paint } from "./backgroundPalette.ts";
import { commands, run } from "./cli.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  image,
  over,
  polygon,
  rect,
  type RgbaImage,
  writeImage,
} from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const KEY = "industrial-underwater-window";
const WIDTH = 48;
const HEIGHT = 240;

function pressureWindow(): RgbaImage {
  const water = paint("industrial", "mid", "base", pixel.hexc("zone-blue"));
  const surfaceLight = paint("industrial", "mid", "light", pixel.hexc("zone-blue"));
  const plant = paint("industrial", "near", "light", pixel.hexc("zone-green"));
  const frame = paint("industrial", "near", "shade");
  const bevel = paint("industrial", "near", "light");
  const panel = image(WIDTH, HEIGHT, water);

  // Recessed panes vary in height and keep their painted details inside the frame.
  polygon(
    { colour: surfaceLight },
    [
      [4, 9],
      [27, 9],
      [6, 73],
      [4, 73],
    ],
    panel,
  );
  polygon(
    { colour: surfaceLight },
    [
      [4, 129],
      [36, 129],
      [4, 199],
    ],
    panel,
  );

  // Kelp blades rise from the sill, with the tallest side of the bed under deeper glass.
  for (const blade of [
    [
      [14, 227],
      [15, 206],
      [9, 186],
      [10, 179],
      [16, 185],
      [20, 204],
      [18, 227],
    ],
    [
      [22, 230],
      [23, 203],
      [29, 186],
      [29, 166],
      [33, 158],
      [35, 170],
      [33, 190],
      [27, 207],
      [26, 230],
    ],
    [
      [31, 231],
      [33, 208],
      [39, 201],
      [41, 186],
      [44, 179],
      [44, 195],
      [42, 205],
      [37, 212],
      [35, 231],
    ],
  ] as const) {
    polygon({ colour: plant }, blade, panel);
  }
  polygon(
    { colour: plant },
    [
      [7, 235],
      [10, 228],
      [18, 227],
      [25, 231],
      [32, 226],
      [40, 229],
      [43, 235],
    ],
    panel,
  );
  for (const [x, y, width] of [
    [33, 34, 3],
    [15, 75, 4],
    [30, 96, 5],
    [23, 143, 4],
    [8, 164, 3],
    [16, 204, 3],
  ] as const) {
    rect(surfaceLight, [x, y, x + width, y + 2], panel);
  }

  // Half-width rails become full rails at the texture joins.
  for (const [top, bottom] of [
    [0, 4],
    [113, 121],
    [236, HEIGHT],
  ] as const) {
    rect(frame, [0, top, WIDTH, bottom], panel);
  }
  rect(bevel, [3, 4, 45, 7], panel);
  rect(bevel, [3, 121, 45, 124], panel);
  rect(frame, [0, 0, 3, HEIGHT], panel);
  rect(frame, [45, 0, WIDTH, HEIGHT], panel);
  rect(bevel, [3, 7, 5, 113], panel);
  rect(bevel, [3, 124, 5, 236], panel);

  return panel;
}

function build(): void {
  const panel = pressureWindow();
  writeImage(`${BACKDROPS_DIR}/${KEY}.png`, panel);
  pixel.updateManifest("backdrops", [backdropEntry({ bottom: 600, repeat: "x" }, KEY, panel)]);
}

function preview(out: string): void {
  const panel = pressureWindow();
  const repeat = image(3 * WIDTH, 3 * HEIGHT);
  for (let y = 0; y < repeat.height; y += HEIGHT) {
    for (let x = 0; x < repeat.width; x += WIDTH) {
      over([x, y], panel, repeat);
    }
  }
  writeImage(out, repeat);
}

if (import.meta.main) {
  run(() =>
    commands({ usage: "Usage: industrialUnderwater.ts build | preview OUT.png", build, preview }),
  );
}
