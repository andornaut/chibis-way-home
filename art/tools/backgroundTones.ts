/**
 * Muted background-only paint, using the existing game palette without changing any occupied
 * pixel.
 *
 * The original generators retain their geometry. Their normal builds apply this same publication
 * policy. Foreground tiles, actors, UI, portraits and opening art never pass through this adapter.
 * Ordered far, middle and near backgrounds use perceptual ranks in backgroundPalette.ts. Continuous
 * source-colour residuals retain material and detail differences. Local decorative props use the
 * near rank. Functional wayfinding, flat zone skies and the inactive Park prototype retain their
 * existing publication policy.
 *
 * Usage: node art/tools/backgroundTones.ts build, from the repository root. This exports existing
 * backdrop keys only.
 */

import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as backgroundPalette from "./backgroundPalette.ts";
import { commands, run } from "./cli.ts";
import { BACKDROPS_DIR, frameImage, writeImage } from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const USAGE = "Usage: backgroundTones.ts build";

type Layer = "far" | "mid" | "near";
type Rgb = readonly [number, number, number];

const FUNCTIONAL: ReadonlySet<string> = new Set([
  "apartment-room-door",
  "apartment-stairwell",
  "apartment-stairwell-down",
  "parcel-open",
  "walk-signal",
]);
const SKIES: ReadonlySet<string> = new Set([
  "apartment-sky",
  "countryside-sky",
  "homecity-sky",
  "industrial-sky",
  "street-sky",
  "woodland-sky",
]);
const FAR: ReadonlySet<string> = new Set([
  "apartment-far",
  "countryside-far",
  "homecity-far",
  "industrial-far",
  "park-city",
  "park-clouds",
  "park-far-trees",
  "street-city-far",
  "street-skyline",
  "woodland-far",
  "woodland-far-conifers",
]);
const MID: ReadonlySet<string> = new Set([
  "apartment-exterior-mid",
  "farmland-mid",
  "forest-mid",
  "forest-mid-birch",
  "forest-mid-conifers",
  "freight-mid",
  "neighbourhood-mid",
  "outskirts-mid",
  "park-treetops",
  "ravine-mid",
  "river-mid",
  "street-boundary-mid",
  "street-city-mid",
  "warehouse-mid",
]);
const NEAR: ReadonlySet<string> = new Set([
  "apartment-facade",
  "apartment-wall-lobby",
  "apartment-wall-pool",
  "apartment-wall-residential",
  "apartment-wall-restaurant",
  "apartment-wall-spa",
  "depot-wall",
  "facade-brownstone",
  "facade-one-storey",
  "facade-walkup",
  "facade-walkup-upper",
  "farmland-fence",
  "forest-shrub",
  "forest-tree",
  "neighbourhood-wall",
  "outskirts-wall",
  "ravine-rock",
  "roofline-brownstone",
  "roofline-walkup",
  "storefront-cafe",
  "storefront-diner",
  "storefront-florist",
  "storefront-gift-shop",
  "storefront-makeup-store",
  "storefront-noodle-bar",
  "storefront-pet-shop",
  "warehouse-wall",
]);
export const ZONES: Readonly<Record<string, string>> = {
  apartment: "zone-red",
  countryside: "zone-yellow",
  homecity: "zone-peach",
  industrial: "zone-purple",
  park: "zone-peach",
  street: "zone-blue",
  woodland: "zone-green",
};
const GROUPS: readonly (readonly [zone: string, prefixes: readonly string[]])[] = [
  ["apartment", ["apartment-"]],
  ["countryside", ["countryside-", "farmland-", "river-"]],
  ["homecity", ["homecity-", "neighbourhood-", "outskirts-"]],
  ["industrial", ["freight-", "industrial-", "warehouse-"]],
  ["park", ["park-"]],
  ["woodland", ["forest-", "ravine-", "woodland-"]],
];
const accents = (names: readonly string[], tone: string) => names.map((name) => [name, tone]);
export const ACCENTS: Readonly<Record<string, string>> = Object.fromEntries([
  ...accents(["blue", "sky", "cyan", "zone-blue", "zone-blue-shade"], "zone-blue"),
  ...accents(["green", "dgreen", "forest", "teal", "zone-green", "zone-green-shade"], "zone-green"),
  ...accents(["red", "dred", "hot", "pink"], "zone-red"),
  ...accents(["orange", "amber", "yellow", "rust", "ochre", "skin1", "tan"], "zone-peach"),
]);

// Each authored wall paint represents a material role: keep joints distinct from adjacent panels.
const WALL_PAINT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "apartment-wall-lobby": {
    "zone-red": "lgrey",
    "zone-red-shade": "zone-red",
    "zone-peach-shade": "zone-peach",
    brown: "zone-red-shade",
  },
  "apartment-wall-pool": {
    "zone-red": "lgrey",
    "zone-red-shade": "zone-red",
    "zone-blue": "zone-blue",
    "zone-blue-shade": "grey",
  },
  "apartment-wall-spa": {
    "zone-red": "lgrey",
    "zone-red-shade": "zone-red",
    "zone-green": "zone-green",
    "zone-green-shade": "zone-green-shade",
  },
};

// Authored plaster, panels and joints keep separate material roles at the same near depth.
const WALLS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "apartment-wall-lobby": {
    "zone-red": "bg-apartment-near-light",
    "zone-red-shade": "bg-apartment-near-shade",
    "zone-peach-shade": "bg-apartment-near-wood",
    brown: "bg-apartment-near-wood-shade",
  },
  "apartment-wall-pool": {
    "zone-red": "bg-apartment-near-light",
    "zone-red-shade": "bg-apartment-near-shade",
    "zone-blue": "bg-apartment-near-blue",
    "zone-blue-shade": "bg-apartment-near-blue-shade",
  },
  "apartment-wall-spa": {
    "zone-red": "bg-apartment-near-light",
    "zone-red-shade": "bg-apartment-near-shade",
    "zone-green": "bg-apartment-near-green",
    "zone-green-shade": "bg-apartment-near-green-shade",
  },
  "apartment-wall-residential": {
    "zone-red": "bg-apartment-near-light",
    "zone-red-shade": "bg-apartment-near-shade",
  },
  "apartment-wall-restaurant": {
    "zone-red": "bg-apartment-near-light",
    "zone-red-shade": "bg-apartment-near-shade",
    "zone-peach": "bg-apartment-near-wood",
  },
  "apartment-facade": {
    "zone-red": "bg-apartment-near-light",
    "zone-red-shade": "bg-apartment-near-shade",
    dslate: "bg-apartment-near-shade",
    "zone-blue-shade": "bg-apartment-near-blue",
    slate: "bg-apartment-near-blue-shade",
  },
  "warehouse-wall": {
    "zone-purple": "bg-industrial-near-light",
    "zone-purple-shade": "bg-industrial-near",
    slate: "bg-industrial-near-shade",
    dslate: "bg-industrial-near-shade",
  },
  "outskirts-wall": { "zone-red-shade": "bg-homecity-near-shade" },
};

/** Source RGB to target RGB, keyed by "r,g,b". */
type ColourMap = Map<string, Rgb>;

const rgbKey = (colour: Rgb): string => colour.join(",");

function set(mapping: ColourMap, source: string, target: string): void {
  mapping.set(rgbKey(pixel.rgb(source)), pixel.rgb(target));
}

function profile(key: string): [zone: string, layer: Layer | "sky" | "local"] {
  const zone =
    GROUPS.find(([, prefixes]) => prefixes.some((prefix) => key.startsWith(prefix)))?.[0] ??
    "street";
  const layer = SKIES.has(key)
    ? "sky"
    : FAR.has(key)
      ? "far"
      : MID.has(key)
        ? "mid"
        : NEAR.has(key)
          ? "near"
          : "local";
  return [zone, layer];
}

function depthColourMap(key: string): ColourMap {
  const [zone, profiled] = profile(key);
  const result: ColourMap = new Map();
  if (profiled === "sky") {
    for (const colour of Object.values(pixel.K)) {
      set(result, colour, colour);
    }
    return result;
  }
  const layer: Layer = profiled === "local" ? "near" : profiled;
  for (const [source, colour] of Object.entries(backgroundPalette.sourceColours(pixel.K))) {
    let target = backgroundPalette.detailName(zone, layer, source);
    if (zone === "countryside" && layer === "far" && source === "zone-peach") {
      target = "bg-countryside-far-warm";
    } else if (zone === "woodland" && layer === "mid" && source === "white") {
      target = "bg-woodland-mid-bark";
    } else if (zone === "woodland" && layer === "near" && source === "zone-peach-shade") {
      target = "bg-woodland-near-wood";
    }
    set(result, colour, target);
  }
  for (const [source, target] of Object.entries(WALLS[key] ?? {})) {
    set(result, source, target);
  }
  return result;
}

function colourMap(key: string): ColourMap {
  const [zone, layer] = profile(key);
  if (zone !== "park") {
    return depthColourMap(key);
  }
  const primary = ZONES[zone] as string;
  const result: ColourMap = new Map();
  for (const [name, colour] of Object.entries(pixel.K)) {
    const brightness = pixel.contrast(colour, pixel.hex("ink"));
    // Only the park reaches here, so its far layer fills lgrey.
    let tone: string;
    if (layer === "far") {
      tone = brightness < 8 ? "lgrey" : "white";
    } else if (layer === "local" && Object.hasOwn(ACCENTS, name)) {
      tone = ACCENTS[name] as string;
    } else {
      tone = brightness < 3 ? `${primary}-shade` : brightness < 8 ? primary : "lgrey";
    }
    set(result, colour, tone);
  }
  for (const [source, target] of Object.entries(WALL_PAINT[key] ?? {})) {
    set(result, source, target);
  }
  return result;
}

/** image with every occupied pixel's colour mapped by its key's policy, alpha kept. */
export function apply(key: string, image: RgbaImage): RgbaImage {
  if (FUNCTIONAL.has(key) || SKIES.has(key)) {
    return image;
  }
  const mapping = colourMap(key);
  const data = new Uint8Array(image.data);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) {
      continue;
    }
    const colour = [data[i], data[i + 1], data[i + 2]].join(",");
    const target = mapping.get(colour);
    if (!target) {
      throw new Error(`${key}: no background tone for rgb ${colour}`);
    }
    data.set(target, i);
  }
  return { data, height: image.height, width: image.width };
}

/** Every producer's backdrop as drawn, before this policy, in the producers' order. */
async function* sourceImages(): AsyncGenerator<readonly [key: string, image: RgbaImage]> {
  // Loaded when building: every producer imports this module for its own build.
  const floor1 = await import("./floor1.ts");
  for (const [key, [draw]] of floor1.BACKDROP_DEFS) {
    yield [key, frameImage(draw().px)];
  }
  const depot = await import("./depot.ts");
  for (const [key, [image]] of Object.entries(depot.assets())) {
    yield [key, image];
  }
  const park = await import("./park.ts");
  for (const [key, [draw]] of park.BACKDROP_DEFS) {
    yield [key, draw()];
  }
  for (const producer of [
    await import("./industrial.ts"),
    await import("./countryside.ts"),
    await import("./woodland.ts"),
    await import("./homecity.ts"),
    await import("./apartment.ts"),
  ]) {
    for (const [key, [draw]] of Object.entries(producer.BACKDROPS)) {
      yield [key, draw()];
    }
  }
  const props = await import("./apartmentProps.ts");
  for (const key of Object.keys(props.SIZES)) {
    yield [`apartment-${key}`, props.draw(key)];
  }
}

export async function build(): Promise<void> {
  for await (const [key, image] of sourceImages()) {
    if (!FUNCTIONAL.has(key)) {
      writeImage(`${BACKDROPS_DIR}/${key}.png`, apply(key, image));
    }
  }
  console.log("built muted existing background paints");
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build }));
}
