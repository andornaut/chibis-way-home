import { describe, expect, it } from "vitest";

import { type MapAction, mapKeyAction } from "./mapInput";

describe("map footer keyboard input", () => {
  it.each(["Enter", "Space"])("defaults %s to Continue without focus", (code) => {
    expect(mapKeyAction(undefined, { code, repeat: false, shiftKey: false })).toEqual({
      kind: "activate",
      target: "continue",
    });
  });

  it.each([
    { code: "Tab", focus: undefined, shiftKey: false, target: "continue" },
    { code: "Tab", focus: "continue", shiftKey: false, target: "home" },
    { code: "Tab", focus: "home", shiftKey: false, target: "continue" },
    { code: "Tab", focus: "continue", shiftKey: true, target: "home" },
  ] as const)("Tab from $focus selects $target", ({ code, focus, shiftKey, target }) => {
    expect(mapKeyAction(focus, { code, repeat: false, shiftKey })).toEqual({
      kind: "focus",
      target,
    });
  });

  it.each(["continue", "home"] as const)(
    "activates explicitly focused %s only on a fresh press",
    (focus) => {
      const key = { code: "Enter", repeat: false, shiftKey: false };
      expect(mapKeyAction(focus, key)).toEqual({ kind: "activate", target: focus });
      expect(mapKeyAction(focus, { ...key, repeat: true })).toBeUndefined();
    },
  );

  it.each(["ArrowUp", "KeyE", "KeyW"])(
    "keeps %s a direct Continue shortcut even with Home focused",
    (code) => {
      expect(mapKeyAction("home", { code, repeat: false, shiftKey: false })).toEqual({
        kind: "activate",
        target: "continue",
      });
    },
  );

  it.each(["Escape", "BrowserBack", "KeyP"])("leaves existing %s handling untouched", (code) => {
    expect(mapKeyAction("home", { code, repeat: false, shiftKey: false })).toBeUndefined();
  });
});

describe("map navigation", () => {
  it.each([
    { by: -1, code: "ArrowLeft" },
    { by: 1, code: "ArrowRight" },
    { by: -1, code: "KeyA" },
    { by: 1, code: "KeyD" },
  ])("retains $code zone selection while a footer action is focused", ({ by, code }) => {
    const focuses: readonly (MapAction | undefined)[] = [undefined, "continue", "home"];
    expect(
      focuses.map((focus) => mapKeyAction(focus, { code, repeat: true, shiftKey: false })),
    ).toEqual(focuses.map(() => ({ by, kind: "step" })));
  });
});
