import { expect, it } from "vitest";

import { mapKeyAction } from "./mapInput.ts";

it.each([
  { by: -1, code: "ArrowLeft" },
  { by: 1, code: "ArrowRight" },
  { by: -1, code: "KeyA" },
  { by: 1, code: "KeyD" },
  { by: -1, code: "KeyH" },
  { by: 1, code: "KeyL" },
])("retains $code destination traversal", ({ by, code }) => {
  expect(mapKeyAction({ code })).toEqual({ by, kind: "step" });
});

it.each([
  "ArrowDown",
  "ArrowUp",
  "Enter",
  "Escape",
  "KeyE",
  "KeyF",
  "KeyK",
  "KeyP",
  "KeyW",
  "Space",
  "Tab",
])("leaves %s to its document foreground owner", (code) =>
  expect(mapKeyAction({ code })).toBeUndefined(),
);
