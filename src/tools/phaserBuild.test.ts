import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { phaserBuildProblems, shippedModules } from "../platform/build/phaserUses";
import { PHASER_BUILD } from "./phaserBuild";

const REPO = join(import.meta.dirname, "../..");

describe("the build's Phaser", () => {
  it("leaves out nothing the game uses", () => {
    const shipped = shippedModules(REPO, ["src"]);
    expect(phaserBuildProblems(PHASER_BUILD, REPO, shipped)).toEqual([]);
  });
});
