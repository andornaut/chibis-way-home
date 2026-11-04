import { describe, expect, it } from "vitest";

import { deathKeyAction } from "./deathInput";

describe("required death card input", () => {
  it.each(["Enter", " "])("defaults a fresh %s to safe Retry", (key) => {
    expect(deathKeyAction(undefined, { key, repeat: false, shiftKey: false })).toEqual({
      action: "retry",
      focus: undefined,
    });
    expect(
      deathKeyAction(undefined, { key, repeat: true, shiftKey: false }).action,
    ).toBeUndefined();
  });
  it.each(["Escape", "p", "P", "BrowserBack"])("does not dismiss through %s", (key) => {
    expect(
      deathKeyAction(undefined, { key, repeat: false, shiftKey: false }).action,
    ).toBeUndefined();
  });
  it("requires explicit focus before Back to title can activate", () => {
    const key = { key: "Tab", repeat: false, shiftKey: false };
    const first = deathKeyAction(undefined, key);
    expect(first.focus).toBe("retry");
    const second = deathKeyAction(first.focus, key);
    expect(second.focus).toBe("home");
    expect(deathKeyAction(second.focus, { ...key, key: "Enter" }).action).toBe("home");
  });
});
