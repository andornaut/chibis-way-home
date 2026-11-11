import { describe, expect, it } from "vitest";

import { reducedMotion, setReducedMotion } from "./reducedMotion";

// A window whose device preference the test sets, over a storage it can share with another.
function device(prefers: boolean, stored = new Map<string, string>()) {
  const query = { matches: prefers };
  const host = {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    },
    matchMedia: () => query,
  } as unknown as Window;
  return { host, query, stored };
}

describe("the Reduced motion setting", () => {
  it.each([true, false])("first follows a device preference of %s", (prefers) => {
    expect(reducedMotion(device(prefers).host)).toBe(prefers);
  });

  it("follows the device preference as it changes until the player sets it", () => {
    const { host, query } = device(false);
    expect(reducedMotion(host)).toBe(false);
    query.matches = true;
    expect(reducedMotion(host)).toBe(true);
    setReducedMotion(host, false);
    query.matches = true;
    expect(reducedMotion(host)).toBe(false);
  });

  it.each([true, false])("keeps a stored choice of %s over the device preference", (on) => {
    const first = device(!on);
    setReducedMotion(first.host, on);
    expect(reducedMotion(device(!on, first.stored).host)).toBe(on);
  });

  it("persists each toggle for the next page", () => {
    const first = device(true);
    setReducedMotion(first.host, !reducedMotion(first.host));
    expect(reducedMotion(device(true, first.stored).host)).toBe(false);
    setReducedMotion(first.host, !reducedMotion(first.host));
    expect(reducedMotion(device(false, first.stored).host)).toBe(true);
  });

  it("keeps a choice for the page where storage is blocked", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    const host = {
      localStorage: { getItem: blocked, setItem: blocked },
      matchMedia: () => ({ matches: true }),
    } as unknown as Window;
    expect(reducedMotion(host)).toBe(true);
    setReducedMotion(host, false);
    expect(reducedMotion(host)).toBe(false);
  });
});
