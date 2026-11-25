// Where each module of src/ sits. A group is a folder of src/, a file directly in it, or an area:
// a subfolder of a folder that NESTED_GROUPS names.
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
  { band: "Model", groups: ["assets", "rules/bird"] },
  { band: "Model", groups: ["rules/boss"] },
  { band: "Model", groups: ["rules/stage"] },
  { band: "Model", groups: ["rules/zone"] },
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

/** The folders of src/ split into areas: each subfolder is a group with its own entry. */
export const NESTED_GROUPS: readonly string[] = ["rules"];

/** The group of a path under src/. */
export function groupOf(path: string): string {
  const [, folder = "", area, ...rest] = path.split("/");
  return NESTED_GROUPS.includes(folder) && area !== undefined && rest.length > 0
    ? `${folder}/${area}`
    : folder;
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
