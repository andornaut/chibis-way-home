import { expect, it } from "vitest";

import { tuningRows } from "./catalogue";

it("shows sorted actual nested values without changing their source", () => {
  const path = Object.freeze([2, 4]);
  const source = Object.freeze(
    Object.fromEntries([
      ["Zebra", Object.freeze({ speed: 12.5 })],
      [
        "Alpha",
        Object.freeze({ enabled: false, mode: "steady", optional: null, path, unused: undefined }),
      ],
    ]),
  );
  expect(tuningRows(source)).toEqual([
    { group: "Alpha", path: "enabled", value: "false" },
    { group: "Alpha", path: "mode", value: "steady" },
    { group: "Alpha", path: "optional", value: "null" },
    { group: "Alpha", path: "path.0", value: "2" },
    { group: "Alpha", path: "path.1", value: "4" },
    { group: "Zebra", path: "speed", value: "12.5" },
  ]);
  expect(path).toEqual([2, 4]);
});
