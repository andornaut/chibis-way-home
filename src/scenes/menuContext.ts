export const MENU_CONTENT_SCENES = [
  "update",
  "cheats",
  "settings",
  "skillDetail",
  "achievements",
  "restart",
  "stageSelect",
  "dialogueChoice",
  "zoneDeparture",
  "dialogue",
  "cutscene",
  "death",
  "room",
  "celebration",
  "opening",
  "map",
  "zoneIntroduction",
  "zone",
  "start",
] as const;

export interface MenuContext {
  readonly homeShown: boolean;
  readonly mode: "menu" | "pause";
  readonly scene: string;
}

export function menuContext(
  active: (key: string) => boolean,
  paused: (key: string) => boolean,
  pausable: string | undefined,
): MenuContext | undefined {
  if (active("boot")) {
    return undefined;
  }
  const scene = MENU_CONTENT_SCENES.find(active) ?? MENU_CONTENT_SCENES.find(paused);
  if (scene === undefined) {
    return undefined;
  }
  return {
    homeShown: scene !== "start",
    mode: active(scene) && scene === pausable ? "pause" : "menu",
    scene,
  };
}

export type NestedMenuCard = "achievements" | "cheats" | "settings";

export interface MenuFrame {
  readonly dimmed: boolean;
  readonly held: string[];
  readonly homeShown: boolean;
  readonly mode: "menu" | "pause";
  readonly nestedFocus: HTMLElement | undefined;
  readonly over: string | undefined;
  readonly returnEntryFocus: boolean;
  readonly state: NestedMenuCard | "open" | "skill";
  readonly waitFor: string | undefined;
}
