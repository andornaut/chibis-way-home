import { readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/runtime/art/aseprite";
import { expect, it } from "vitest";

import manifest from "../../../public/art/manifest.json" with { type: "json" };
import { UI_FRAMES } from "./skin.ts";

type SheetWithGeometry = AsepriteSheet & {
  readonly frames: Readonly<
    Record<string, { readonly frame: { readonly w: number; readonly h: number } }>
  >;
};

it("resolves every registered DOM skin frame against the published art tags and slice geometry", () => {
  for (const { art, name, slice, tag, whole } of UI_FRAMES) {
    const sprite = manifest.sprites.find(({ key }) => key === art);
    expect(sprite, name).toBeDefined();
    const sheet = JSON.parse(
      readFileSync(`public/art/${sprite!.json}`, "utf8"),
    ) as SheetWithGeometry;
    const tags = sheetTags(sheet);
    if (tag !== undefined) {
      expect(tags.get(tag)?.length, `${name}:${tag}`).toBeGreaterThan(0);
    }
    if (whole !== true) {
      const insets = slice ?? ("slice" in sprite! ? sprite.slice : undefined);
      expect(insets, name).toBeDefined();
      const frame =
        tag === undefined
          ? Object.values(sheet.frames)[0]!.frame
          : sheet.frames[tags.get(tag)![0]!.frame]!.frame;
      expect(frame.w, name).toBeGreaterThan(insets!.left + insets!.right);
      expect(frame.h, name).toBeGreaterThan(insets!.top + insets!.bottom);
    }
  }
});
