import { join } from "node:path";

import { phaserBuildProblems, shippedModules } from "@andornaut/game-kit/build/phaserUses";
import { describe, expect, it } from "vitest";

import { PHASER_BUILD } from "./phaserBuild.ts";

const REPO = join(import.meta.dirname, "../..");

// Scanning every shipped source module for Phaser uses takes several seconds on CI runners.
const SCAN_TIMEOUT_MS = 30_000;

describe("the build's Phaser", () => {
  it("leaves out nothing the game uses", { timeout: SCAN_TIMEOUT_MS }, () => {
    const shipped = shippedModules(REPO, ["src"]);
    expect(phaserBuildProblems(PHASER_BUILD, REPO, shipped)).toEqual([]);
  });
});
