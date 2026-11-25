import { afterEach, expect, it, vi } from "vitest";

const KEY = "chibis-way-home.invincibility";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function storage(values: Map<string, string>) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  });
}

it("keeps Invincibility off by default and on across a reload until switched off", async () => {
  const values = new Map<string, string>();
  storage(values);
  const first = await import("./mode.ts");
  expect(first.invulnerabilityEnabled()).toBe(false);
  first.setInvulnerability(true);

  vi.resetModules();
  const reloaded = await import("./mode.ts");
  expect(reloaded.invulnerabilityEnabled()).toBe(true);
  reloaded.setInvulnerability(false);
  expect([reloaded.invulnerabilityEnabled(), values.has(KEY)]).toEqual([false, false]);
});

it("keeps Invincibility for the page where storage is blocked", async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  });
  const mode = await import("./mode.ts");
  expect(mode.invulnerabilityEnabled()).toBe(false);
  mode.setInvulnerability(true);
  expect(mode.invulnerabilityEnabled()).toBe(true);
});
