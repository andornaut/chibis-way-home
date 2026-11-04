import { describe, expect, it } from "vitest";

import { decodeTouchSetting, encodeTouchSetting } from "./touchControls";

describe("the touch settings", () => {
  it.each([true, false])("read back %s as stored", (shown) => {
    expect(decodeTouchSetting(encodeTouchSetting(shown))).toBe(shown);
  });

  it.each([null, "", "unknown"])("read %j as shown", (stored) => {
    expect(decodeTouchSetting(stored)).toBe(true);
  });
});
