import { expect, it } from "vitest";

import { menuContext } from "./menuContext.ts";

it("uses actual pausable content for Pause and keeps nonpausable or covered content on Menu", () => {
  const active = new Set(["zone"]);
  const context = (pausable: string | undefined) =>
    menuContext(
      (key) => active.has(key),
      () => false,
      pausable,
    );
  expect(context("zone")).toMatchObject({ mode: "pause", scene: "zone" });
  active.add("dialogue");
  expect(context("dialogue")).toMatchObject({ mode: "pause", scene: "dialogue" });
  expect(context(undefined)).toMatchObject({ mode: "menu", scene: "dialogue" });
  active.add("death");
  active.delete("dialogue");
  expect(context(undefined)).toMatchObject({ mode: "menu", scene: "death" });
  active.clear();
  active.add("start");
  expect(context(undefined)).toEqual({ homeShown: false, mode: "menu", scene: "start" });
  active.clear();
  active.add("map");
  expect(context("map")).toEqual({ homeShown: true, mode: "menu", scene: "map" });
  active.clear();
  expect(
    menuContext(
      () => false,
      (key) => key === "zone",
      "zone",
    ),
  ).toEqual({ homeShown: true, mode: "menu", scene: "zone" });
  active.add("boot");
  expect(context(undefined)).toBeUndefined();
});
