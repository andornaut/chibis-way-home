import type { GameObjects, Scene } from "phaser";

const mixedRoots = new WeakMap<Scene, Set<GameObjects.GameObject>>();
const mixedScenes = new Set(["celebration", "map", "opening", "room", "start", "zone"]);
const uiScenes = new Set([
  "achievementNotice",
  "achievements",
  "cutscene",
  "death",
  "dialogue",
  "dialogueChoice",
  "pause",
  "restart",
  "settings",
  "skillDetail",
  "stageSelect",
  "update",
  "zoneBark",
  "zoneDeparture",
  "zoneIntroduction",
]);

// Declare the UI boundary without changing hierarchy, visibility or the existing input route.
export function uiObject<T extends GameObjects.GameObject>(scene: Scene, object: T): T {
  if (!mixedScenes.has(scene.sys?.settings.key)) {
    return object;
  }
  let roots = mixedRoots.get(scene);
  if (!roots) {
    roots = new Set();
    mixedRoots.set(scene, roots);
  }
  if (roots.has(object)) {
    return object;
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
  if (mixedScenes.has(key)) {
    return [...(mixedRoots.get(scene) ?? [])];
  }
  return key === "boot" ? [] : undefined;
}
