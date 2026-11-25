// Where each module of src/ sits. A group is a folder of src/ or a file directly in it.
// CLEANUP (added 2026-11-25): remove when the known-violations table is empty and ESLint guards
// the layers (cwh-0310).

/** One layer: the groups in it and the band of the shared source structure it belongs to. */
export type Layer = { readonly band: string; readonly groups: readonly string[] };

/**
 * The layers of src/, lowest first, each inside one band. A module outside the tests imports its
 * own group and any group in a lower layer, never another group in its own layer or one above.
 * Everything below Support is the game and its pages; Support never ships.
 */
export const LAYERS: readonly Layer[] = [
  { band: "Foundation", groups: ["data"] },
  { band: "Foundation", groups: ["ai", "buildLabel.ts", "camera", "core", "stage"] },
  { band: "Model", groups: ["assets", "rules"] },
  { band: "Saving", groups: ["progress"] },
  { band: "Presentation", groups: ["presentation", "ui"] },
  { band: "Platform", groups: ["crash", "dev"] },
  { band: "Platform", groups: ["loading"] },
  { band: "Platform", groups: ["pwa"] },
  { band: "Engine and views", groups: ["scenes"] },
  { band: "Entries", groups: ["gallery", "homePage", "main.ts", "play.ts", "tuningPage"] },
  { band: "Support", groups: ["sim"] },
  { band: "Support", groups: ["testing"] },
  { band: "Support", groups: ["build", "tools"] },
];

/** The groups whose every module is its own entry: one table to a file. */
export const OPEN_GROUPS: readonly string[] = ["data"];

/** The group of a path under src/. */
export function groupOf(path: string): string {
  return path.split("/")[1] ?? "";
}

/** The index in LAYERS of a path under src/, or -1 for a module no layer places. */
export function layerOf(path: string): number {
  const group = groupOf(path);
  return LAYERS.findIndex(({ groups }) => groups.includes(group));
}

/** The band of a path under src/, or undefined for a module no layer places. */
export function bandOf(path: string): string | undefined {
  return LAYERS[layerOf(path)]?.band;
}
