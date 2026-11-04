import { describe, expect, it } from "vitest";

import { decodeTouchSetting, encodeTouchSetting } from "./touchControls";

describe("the touch settings", () => {
  it.each([true, false])("read back %s as stored", (shown) => {
    expect(decodeTouchSetting(encodeTouchSetting(shown), null)).toBe(shown);
  });

  it.each([null, "", "unknown"])("read %j as shown", (stored) => {
    expect(decodeTouchSetting(stored, null)).toBe(true);
  });

  // The old single Touch controls setting stands in for a setting not stored since: hidden
  // there hides both, until each is set again.
  it.each([
    { old: null, own: null, shown: true },
    { old: "shown", own: null, shown: true },
    { old: "hidden", own: null, shown: false },
    { old: "hidden", own: "shown", shown: true },
    { old: "shown", own: "hidden", shown: false },
  ])("with $own stored and the old setting $old, reads $shown", ({ old, own, shown }) => {
    expect(decodeTouchSetting(own, old)).toBe(shown);
  });
});
