import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import manifest from "../../public/art/manifest.json";
import button from "../../public/art/sprites/ui-button.json";
import primary from "../../public/art/sprites/ui-button-primary.json";
import playMarkJson from "../../public/art/sprites/ui-play-mark.json";
import { labelledButton } from "../layout/labelledButton";
import { ART_MANIFEST_KEY } from "../view/aseprite";
import { addButtonLabel, addTextButton, BUTTON, PRIMARY_BUTTON } from "./cardParts";

const playMark = playMarkJson as AsepriteSheet;

function drawing(sheet = playMark) {
  const node = {
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
  };
  const image = vi
    .fn<(x: number, y: number, texture: string, frame?: string) => typeof node>()
    .mockReturnValue(node);
  const json = new Map<string, unknown>([
    [ART_MANIFEST_KEY, manifest],
    ["palette", { colours: { ink: "#181425", white: "#ffffff" } }],
    ["ui-button", button],
    ["ui-button-primary", primary],
    ["ui-play-mark", sheet],
  ]);
  const scene = {
    add: { bitmapText: () => node, image, nineslice: () => node },
    cache: {
      bitmapFont: { get: () => ({ data: { chars: {}, lineHeight: 12 } }) },
      json: { get: (key: string) => json.get(key) },
    },
  } as unknown as Scene;
  return { image, scene };
}

const rect = { height: 48, width: 160, x: 0, y: 0 };
const layout = labelledButton(rect, 13);

describe("button play-mark frames", () => {
  it.each([
    { name: "primary", style: PRIMARY_BUTTON, tag: "light" },
    { name: "secondary", style: BUTTON, tag: "rest" },
    { name: "default", style: undefined, tag: "rest" },
  ])("draws the actual $tag tag for $name buttons", ({ style, tag }) => {
    const { image, scene } = drawing();
    addTextButton(scene, layout, "", { marked: true, ...(style && { style }) });
    const frame = sheetTags(playMark).get(tag)![0]!.frame;
    expect(image).toHaveBeenCalledExactlyOnceWith(
      expect.any(Number),
      expect.any(Number),
      "ui-play-mark",
      frame,
    );
  });

  it("preserves the rest tag for direct legacy labels", () => {
    const { image, scene } = drawing();
    addButtonLabel(scene, rect, 13, "", { colour: 0, marked: true });
    expect(image.mock.calls[0]![3]).toBe(sheetTags(playMark).get("rest")![0]!.frame);
  });

  it("rejects a marked primary button when the light asset tag is absent", () => {
    const { scene } = drawing({
      ...playMark,
      meta: {
        ...playMark.meta,
        frameTags: playMark.meta.frameTags!.filter(({ name }) => name !== "light"),
      },
    });
    expect(() => addTextButton(scene, layout, "", { marked: true, style: PRIMARY_BUTTON })).toThrow(
      "No light frame for ui-play-mark",
    );
  });
});
