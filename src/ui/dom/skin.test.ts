import { readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { expect, it } from "vitest";

import manifest from "../../../public/art/manifest.json" with { type: "json" };
import { UI_FRAMES } from "./skin.ts";

it("resolves every registered DOM skin frame against the published art tags and slice geometry", () => {
  for (const { art, name, tag, whole } of UI_FRAMES) {
    const sprite = manifest.sprites.find(({ key }) => key === art);
    expect(sprite, name).toBeDefined();
    const sheet = JSON.parse(readFileSync(`public/art/${sprite!.json}`, "utf8")) as AsepriteSheet;
    if (tag !== undefined) {
      expect(sheetTags(sheet).get(tag)?.length, `${name}:${tag}`).toBeGreaterThan(0);
    }
    if (whole !== true) {
      expect("slice" in sprite!, name).toBe(true);
    }
  }
});
