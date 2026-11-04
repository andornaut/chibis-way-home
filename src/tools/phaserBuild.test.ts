import { join } from "node:path";

import { phaserBuildProblems, shippedModules } from "@andornaut/game-kit/web/build/vite/phaserUses";
import { describe, expect, it } from "vitest";

import { PHASER_BUILD } from "./phaserBuild";

const REPO = join(import.meta.dirname, "../..");

describe("the build's Phaser", () => {
  it("leaves out nothing the game uses", () => {
    const shipped = shippedModules(REPO, ["src"]);
    expect(phaserBuildProblems(PHASER_BUILD, REPO, shipped)).toEqual([]);
  });
});
