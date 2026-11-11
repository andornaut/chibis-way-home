import { expect, it, vi } from "vitest";

import { grantAllSavedSkills } from "./savedSkills";
it("guards installed display modes, iOS apps and stale captured actions at asynchronous commit time", async () => {
  let installed = false;
  let standalone = false;
  let current = true;
  const host = {
    document: { fullscreenElement: null },
    matchMedia: () => ({
      get matches() {
        return installed;
      },
    }),
    navigator: {
      get standalone() {
        return standalone;
      },
    },
  } as unknown as Window;
  const invoke = vi.fn(async ({ available }: { available: () => boolean }) => {
    expect(available()).toBe(true);
    installed = true;
    expect(available()).toBe(false);
    installed = false;
    standalone = true;
    expect(available()).toBe(false);
    standalone = false;
    current = false;
    expect(available()).toBe(false);
    return { reason: "action_unavailable", status: "blocked" as const, writes: [], written: [] };
  });
  expect(await grantAllSavedSkills({ current: () => current, grant: invoke, host })).toMatchObject({
    status: "blocked",
  });
});

it("never invokes a save-changing action in an installed or inaccessible browser context", async () => {
  const grant = vi.fn();
  const host = {
    document: { fullscreenElement: null },
    matchMedia: () => ({ matches: true }),
    navigator: {},
  } as unknown as Window;
  expect(await grantAllSavedSkills({ current: () => true, grant, host })).toMatchObject({
    status: "blocked",
  });
  const unavailable = {
    ...host,
    matchMedia: () => {
      throw new Error("Unavailable browser");
    },
  } as Window;
  expect(
    await grantAllSavedSkills({ current: () => true, grant, host: unavailable }),
  ).toMatchObject({ status: "blocked" });
  expect(grant).not.toHaveBeenCalled();
});
