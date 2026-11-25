import { encodeSave } from "@andornaut/game-kit/runtime/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import { afterEach, expect, it, vi } from "vitest";

import { CHUNKS } from "../../data/chunks.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { RECIPES } from "../../data/zones.ts";
import { createPageSave } from "./pageSave.ts";
import { BEGINNING, PROGRESS_KEYS, progressFormat } from "./progress.ts";

// A page save of its own over the stubbed localStorage.
const openPageSave = () => createPageSave(localSaveStorage(), () => false);
afterEach(() => {
  vi.unstubAllGlobals();
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
  const page = openPageSave();
  await page.loadProgress();
  expect(page.grantSkill("doubleJump")).toBe(true);
  expect(page.activeSkill()).toBeNull();
  expect(page.savedSkills()).toEqual(["dash", "doubleJump"]);
});
