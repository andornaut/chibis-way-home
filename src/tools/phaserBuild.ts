import type { PhaserBuild } from "../platform/build/phaserBuild";

// The production build's Phaser (the kit's build/vite/phaserBuildPlugin): WebGL alone, as
// src/main.ts asks for, with no sound manager, since the game has no sound, and without the
// namespaces the game reads nothing from. phaserBuild.test.ts fails when the game uses
// something it leaves out.
export const PHASER_BUILD: PhaserBuild = {
  flags: { CANVAS_RENDERER: false, FEATURE_SOUND: false },
  omitted: [
    "Actions",
    "Class",
    "Curves",
    "DOM",
    "Geom",
    "Physics",
    "Plugins",
    "Sound",
    "Structs",
    "Utils",
  ],
};
