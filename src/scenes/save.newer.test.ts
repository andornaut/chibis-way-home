import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// Storage holding initial, recording every write.
function storage(initial: readonly (readonly [string, string])[]): [string, string][] {
  const values = new Map<string, string>(initial);
  const writes: [string, string][] = [];
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push([key, value]);
      values.set(key, value);
    },
  });
  return writes;
}

it("reports the saves current when no newer version wrote them", async () => {
  storage([]);
  const save = await import("./save");
  expect(await save.loadProgress()).toBe("current");
});

it.each(["chibis-way-home.achievements", "chibis-way-home.save", "chibis-way-home.stats"])(
  "reports a newer %s and writes nothing",
  async (key) => {
    const writes = storage([[key, '{"version":999999}']]);
    const save = await import("./save");
    expect(await save.loadProgress()).toBe("newer");
    await save.flushStats();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(writes).toEqual([]);
  },
);
