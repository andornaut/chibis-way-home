/**
 * Perceptual background ranks and zone-coloured decorative fauna.
 *
 * Preserve the six flat zone skies. Far, middle and near use progressively darker OKLab lightness
 * bands and bounded chroma, retaining continuous source-material differences. Fauna follows the
 * nearest background with at least 2:1 contrast against its darkest published material. Alpha and
 * geometry are not paint data.
 */

import { oklchToSrgb, srgbToOklab, srgbToOklch } from "@andornaut/art-kit/colour";

import { THEMES } from "./zoneThemes.ts";

type Palette = Readonly<Record<string, string>>;
type Layer = "far" | "mid" | "near";
type Role = "light" | "base" | "shade";
type Triple = [number, number, number];

export const ZONES: Readonly<Record<string, string>> = {
  apartment: "apartment",
  countryside: "countryside",
  homecity: "home-city",
  industrial: "industrial",
  street: "blue-cityscape",
  woodland: "woodland",
};
export const RANK: Readonly<Record<Layer, number>> = { far: 1, mid: 2, near: 3 };
export const LIGHTNESS_STEP = 0.035;
export const WIDTH: Readonly<Record<Layer, number>> = { far: 0.01, mid: 0.014, near: 0.018 };
export const CHROMA: Readonly<Record<Layer, number>> = { far: 0.022, mid: 0.03, near: 0.038 };
export const MATERIAL_WEIGHT: Readonly<Record<Layer, number>> = { far: 0.25, mid: 0.4, near: 0.6 };
export const ROLES: Readonly<Record<Role, number>> = { light: 1, base: 0, shade: -1 };
export const FAUNA_CONTRAST = 2;
export const FAUNA_CHROMA_FRACTION = 0.35;
export const FAUNA_CHROMA_CAP = 0.028;
export const FAUNA_SHADES: Readonly<Record<string, string>> = {
  apartment: "plum",
  countryside: "dbrown",
  homecity: "dbrown",
  industrial: "plum",
  street: "navy",
  woodland: "forest",
};
export const MATERIALS: Readonly<Record<string, readonly [string, Layer, Role, string]>> = {
  "bg-apartment-near-blue": ["apartment", "near", "base", "zone-blue"],
  "bg-apartment-near-blue-shade": ["apartment", "near", "shade", "zone-blue"],
  "bg-apartment-near-green": ["apartment", "near", "base", "zone-green"],
  "bg-apartment-near-green-shade": ["apartment", "near", "shade", "zone-green"],
  "bg-apartment-near-wood": ["apartment", "near", "base", "zone-peach"],
  "bg-apartment-near-wood-shade": ["apartment", "near", "shade", "zone-peach"],
  "bg-countryside-far-warm": ["countryside", "far", "base", "zone-peach"],
  "bg-woodland-mid-bark": ["woodland", "mid", "light", "lgrey"],
  "bg-woodland-near-wood": ["woodland", "near", "shade", "zone-peach"],
};

const LAYERS = Object.keys(RANK) as Layer[];
const ROLE_NAMES = Object.keys(ROLES) as Role[];
const RAD_TO_DEG = 180 / Math.PI;

function lookup<T>(table: Readonly<Record<string, T>>, key: string): T {
  if (!Object.hasOwn(table, key)) throw new Error(`Unknown key: ${key}`);
  return table[key] as T;
}

function bytes(colour: string): Triple {
  return [0, 2, 4].map((i) => Number.parseInt(colour.slice(i, i + 2), 16)) as Triple;
}

function hex(colour: readonly number[]): string {
  return colour.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

/** The float sum by Neumaier compensated summation. */
function sum(values: readonly number[]): number {
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const next = total + value;
    compensation +=
      Math.abs(total) >= Math.abs(value) ? total - next + value : value - next + total;
    total = next;
  }
  return compensation && Number.isFinite(compensation) ? total + compensation : total;
}

export function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722];

export function luminance(colour: string): number {
  const channels = bytes(colour);
  return sum(channels.map((channel, i) => linear(channel) * (LUMINANCE_WEIGHTS[i] as number)));
}

/** Raw paint excludes generated depth colours and the foreground warning role. */
export function sourceColours(house: Palette): Record<string, string> {
  return Object.fromEntries(
    Object.entries(house).filter(([name]) => !name.startsWith("bg-") && name !== "warning-red"),
  );
}

export function primary(zone: string): string {
  return lookup(THEMES, lookup(ZONES, zone)).colour;
}

/** Keep the game layer's cap after byte quantisation, using canonical conversions. */
export function encoded(chromaCap: number, colour: readonly [number, number, number]): string {
  const lightness = colour[0];
  let [, a, b] = colour;
  for (let i = 0; i < 16; i++) {
    const rgb = oklchToSrgb([lightness, Math.hypot(a, b), Math.atan2(b, a) * RAD_TO_DEG]);
    const [, actualChroma] = srgbToOklch(rgb);
    if (actualChroma <= chromaCap) return hex(rgb);
    const scale = Math.min(0.99, (chromaCap - 0.0002) / actualChroma);
    a *= scale;
    b *= scale;
  }
  throw new RangeError("The background paint cannot meet its quantised chroma cap");
}

/** Retain source hue and continuous lightness detail inside a semantic rank. */
export function material(zone: string, layer: Layer, role: Role | null, colour: string): string {
  const [zoneL, zoneA, zoneB] = srgbToOklab(bytes(primary(zone)));
  const [sourceL, sourceA, sourceB] = srgbToOklab(bytes(colour));
  const weight = MATERIAL_WEIGHT[layer];
  const offset = role === null ? 2 * sourceL - 1 : ROLES[role];
  const lightness = zoneL - LIGHTNESS_STEP * RANK[layer] + WIDTH[layer] * offset;
  let a = (1 - weight) * zoneA + weight * sourceA;
  let b = (1 - weight) * zoneB + weight * sourceB;
  const chroma = Math.hypot(a, b);
  if (chroma > CHROMA[layer]) {
    const scale = CHROMA[layer] / chroma;
    a *= scale;
    b *= scale;
  }
  return encoded(CHROMA[layer], [lightness, a, b]);
}

export function paint(zone: string, layer: Layer, role: Role = "base", hue?: string): string {
  return material(zone, layer, role, hue ?? primary(zone));
}

export function detail(zone: string, layer: Layer, colour: string): string {
  return material(zone, layer, null, colour);
}

export function name(zone: string, layer: Layer | "fauna", role: Role = "base"): string {
  return `bg-${zone}-${layer}` + (role === "base" ? "" : `-${role}`);
}

export function detailName(zone: string, layer: Layer, source: string): string {
  return `bg-${zone}-${layer}-source-${source}`;
}

/** Find the lightest quantised fauna paint with 2:1 on every near material. */
export function fauna(zone: string, nearColours: readonly string[]): string {
  const [zoneL, zoneA, zoneB] = srgbToOklab(bytes(primary(zone)));
  const chroma = Math.min(Math.hypot(zoneA, zoneB) * FAUNA_CHROMA_FRACTION, FAUNA_CHROMA_CAP);
  const angle = Math.atan2(zoneB, zoneA);
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const target = (Math.min(...nearColours.map(luminance)) + 0.05) / FAUNA_CONTRAST - 0.05;
  let low = 0;
  let high = zoneL;
  let best = encoded(chroma, [low, a, b]);
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    const candidate = encoded(chroma, [middle, a, b]);
    if (luminance(candidate) <= target) {
      low = middle;
      best = candidate;
    } else {
      high = middle;
    }
  }
  return best;
}

export function colours(house: Palette): Record<string, string> {
  const sources = sourceColours(house);
  const result: Record<string, string> = {};
  for (const zone of Object.keys(ZONES))
    for (const layer of LAYERS)
      for (const role of ROLE_NAMES) result[name(zone, layer, role)] = paint(zone, layer, role);
  for (const zone of Object.keys(ZONES))
    for (const layer of LAYERS)
      for (const [source, colour] of Object.entries(sources))
        result[detailName(zone, layer, source)] = detail(zone, layer, colour);
  for (const [key, [zone, layer, role, hue]] of Object.entries(MATERIALS))
    result[key] = paint(zone, layer, role, lookup(sources, hue));
  for (const zone of Object.keys(ZONES)) {
    const prefix = name(zone, "near");
    const near = Object.entries(result)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, colour]) => colour);
    result[name(zone, "fauna")] = fauna(zone, near);
  }
  return result;
}

/** Follow the existing shade family until modal dimming decreases luminance. */
export function firstDarker(darker: Palette, target: string, colour: string): string {
  const seen = new Set<string>();
  while (luminance(target) >= luminance(colour)) {
    if (seen.has(target) || !Object.hasOwn(darker, target))
      throw new Error("The existing palette has no strictly darker shade");
    seen.add(target);
    target = darker[target] as string;
  }
  return target;
}

export function ramps(darker: Palette, house: Palette): Record<string, string> {
  // Modal dimming uses substantial existing shade steps rather than depth-band steps.
  const paints = colours(house);
  const result: Record<string, string> = {};
  for (const [zone, theme] of Object.entries(ZONES)) {
    const shade = lookup(house, `${lookup(THEMES, theme).primary}-shade`);
    for (const [key, colour] of Object.entries(paints))
      if (key.startsWith(`bg-${zone}-`)) result[colour] = shade;
  }
  const materialShades: Record<string, string> = {
    "bg-apartment-near-blue": "zone-blue-shade",
    "bg-apartment-near-blue-shade": "slate",
    "bg-apartment-near-green": "zone-green-shade",
    "bg-apartment-near-green-shade": "zone-green-shade",
    "bg-apartment-near-wood": "zone-peach-shade",
    "bg-apartment-near-wood-shade": "zone-peach-shade",
    "bg-countryside-far-warm": "zone-peach-shade",
    "bg-woodland-mid-bark": "grey",
    "bg-woodland-near-wood": "zone-peach-shade",
    ...Object.fromEntries(
      Object.entries(FAUNA_SHADES).map(([zone, shade]) => [name(zone, "fauna"), shade]),
    ),
  };
  for (const [key, target] of Object.entries(materialShades))
    result[lookup(paints, key)] = lookup(house, target);
  return Object.fromEntries(
    Object.entries(result)
      .filter(([colour]) => !Object.hasOwn(darker, colour))
      .map(([colour, target]) => [colour, firstDarker(darker, target, colour)]),
  );
}
