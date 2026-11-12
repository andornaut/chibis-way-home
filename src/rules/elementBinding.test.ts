import { describe, expect, it } from "vitest";

import type { Instance } from "../data/types/index.ts";
import { bindElement } from "./elementBinding.ts";

const template: Instance = {
  character: "canonical",
  col: 5,
  cols: 4,
  excludes: ["excluded"],
  overrides: { motion: { distance: 8, speed: 2 } },
  requires: ["required"],
  role: "platform",
  room: "room",
  row: 10,
  rows: 2,
  scene: "intro",
};

describe("element bindings", () => {
  it("overlays configuration, merges tuning and clears a scene without replacing placement or flags", () => {
    const bound = bindElement(
      {
        platform: {
          character: "industrial",
          lines: ["industrial-line"],
          overrides: { motion: { speed: 5 } },
          scene: null,
          skin: { art: "industrial-art", tileset: null },
        },
      },
      template,
    );
    expect(bound).toEqual({
      ...template,
      character: "industrial",
      lines: ["industrial-line"],
      overrides: { motion: { distance: 8, speed: 5 } },
      scene: undefined,
      skin: { art: "industrial-art", tileset: null },
    });
    expect(Object.hasOwn(bound, "scene")).toBe(false);
    expect(template.scene).toBe("intro");
  });
  it("rejects a missing explicit role and preserves untagged legacy instances", () => {
    expect(() => bindElement({}, template)).toThrow("No binding for role platform");
    const untagged = { character: "canonical", col: 0, row: 0 };
    expect(bindElement({}, untagged)).toBe(untagged);
  });
});
