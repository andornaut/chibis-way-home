import type { GameObjects, Scene } from "phaser";

const mixedRoots = new WeakMap<Scene, Set<GameObjects.GameObject>>();
const uiScenes = new Set([
  "achievementNotice",
  "achievements",
  "celebration",
  "cutscene",
  "death",
  "dialogue",
  "dialogueChoice",
  "map",
  "opening",
  "pause",
  "restart",
  "room",
  "settings",
  "skillDetail",
  "stageSelect",
  "start",
  "update",
  "zoneBark",
  "zoneDeparture",
  "zoneIntroduction",
]);

// Declare the UI boundary without changing hierarchy, visibility or the existing input route.
export function uiObject<T extends GameObjects.GameObject>(scene: Scene, object: T): T {
  if (scene.sys?.settings.key !== "zone") {
    return object;
  }
  let roots = mixedRoots.get(scene);
  if (!roots) {
    roots = new Set();
    mixedRoots.set(scene, roots);
  }
  roots.add(object);
  const owned = roots;
  object.once("destroy", () => owned.delete(object));
  return object;
}

export function sceneUiRoots(scene: Scene): readonly GameObjects.GameObject[] | undefined {
  const key = scene.sys.settings.key;
  if (uiScenes.has(key)) {
    return scene.children.list;
  }
  if (key === "zone") {
    return [...(mixedRoots.get(scene) ?? [])];
  }
  return key === "boot" ? [] : undefined;
}
