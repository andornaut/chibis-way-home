import { encodeSave } from "@andornaut/game-kit/runtime/save/versionedSave";
import { afterEach, expect, it, vi } from "vitest";

import { CHUNKS } from "../../data/chunks.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { RECIPES } from "../../data/zones.ts";
import { BEGINNING, PROGRESS_KEYS, progressFormat } from "./progress.ts";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("keeps an owned but unselected save unselected when a later gift arrives", async () => {
  const raw = encodeSave(progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS))), {
    ...BEGINNING,
    skills: ["dash"],
  });
  if (!raw.ok) {
    throw new Error(raw.reason);
  }
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === PROGRESS_KEYS.save ? raw.value : null),
    setItem: vi.fn(),
  });
  const page = await import("./pageSave.ts");
  const session = {
    development: () => false,
    powerUpsUnlocked: () => false,
    skillOverrides: () => ({}),
  };
  await page.loadProgress(session);
  expect(page.grantSkill(session, "doubleJump")).toBe(true);
  expect(page.activeSkill(session)).toBeNull();
  expect(page.savedSkills(session)).toEqual(["dash", "doubleJump"]);
});

it("keeps a developer's temporary selection when the first real gift arrives", async () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  const page = await import("./pageSave.ts");
  const overrides = { dash: true };
  const session = {
    development: () => true,
    powerUpsUnlocked: () => false,
    skillOverrides: () => overrides,
  };
  await page.loadProgress(session);
  expect(page.selectActiveSkill(session, "dash")).toBe(true);
  expect(page.grantSkill(session, "doubleJump")).toBe(true);
  expect(page.activeSkill(session)).toBe("dash");
  expect(page.savedSkills(session)).toEqual(["doubleJump"]);
  overrides.dash = false;
  expect(page.activeSkill(session)).toBeNull();
});
