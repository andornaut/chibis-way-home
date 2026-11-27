import type { Scene } from "phaser";

import { registerSceneForeground } from "./foreground.ts";

// Test scenes omit Phaser's system and scene-plugin metadata, but use the real input adapter.
export function mountFixtureForeground(scene: Scene, key: string, root: HTMLElement): void {
  const systems = scene.sys;
  const plugin = scene.scene;
  const isActive = systems?.isActive?.bind(systems) ?? (() => true);
  const activeScene = plugin.isActive?.bind(plugin);
  Object.assign(scene, {
    input: { ...scene.input, enabled: true },
    scene: {
      ...plugin,
      isActive: (name?: string) =>
        name === undefined ? isActive() : (activeScene?.(name) ?? false),
      key,
    },
    sys: { ...systems, settings: { ...systems?.settings, key } },
  });
  scene.events.once("shutdown", registerSceneForeground(scene, root));
}
