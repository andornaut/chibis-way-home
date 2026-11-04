import { describe, expect, it } from "vitest";

import { artHitboxes } from "./aseprite";

describe("artHitboxes", () => {
  it("maps declared hit boxes and omits sprites without one", () => {
    const sprite = { json: "s.json", key: "frog", once: [], png: "s.png" };
    const hitbox = { height: 30, width: 48, x: 6, y: 6 };
    const frame = { height: 26, width: 50 };
    expect(
      artHitboxes(() => frame, {
        backdrops: [],
        data: [],
        fonts: [],
        images: [],
        sprites: [sprite, { ...sprite, hitbox, key: "trap" }],
        tilesets: [],
      }),
    ).toEqual({ trap: { frame, hitbox } });
  });
});
