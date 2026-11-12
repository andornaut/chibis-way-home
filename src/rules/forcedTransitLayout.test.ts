import { expect, it } from "vitest";

import type { ForcedTransit, Instance } from "../data/types/index.ts";
import { namespaceForcedTransit, resolveForcedTransit } from "./forcedTransitLayout.ts";

const transit: ForcedTransit = {
  banks: [
    { col: -7, cols: 6, id: "lower", purpose: "retreat", row: 0 },
    { col: 7, cols: 6, id: "upper", purpose: "forward", row: -15 },
  ],
  boardingBanks: ["lower"],
  group: "ascent",
  leg: "forward",
  windows: [
    {
      certification: "uncertified",
      result: { bankId: "upper", kind: "egress" },
      riderOnSupport: { col: [2, 4], row: [-3, -3] },
      supportOrigin: { col: [0, 0], row: [-12, -10] },
    },
  ],
};

it("scales rider offsets independently from nominal support and bank origins", () => {
  const resolved = resolveForcedTransit(12, { x: 324, y: 780 }, transit);
  expect(resolved.banks).toEqual([
    { id: "lower", purpose: "retreat", width: 72, x: 240, y: 780 },
    { id: "upper", purpose: "forward", width: 72, x: 408, y: 600 },
  ]);
  expect(resolved.windows[0]).toEqual({
    certification: "uncertified",
    result: { bankId: "upper", kind: "egress" },
    riderOnSupport: { x: [24, 48], y: [-36, -36] },
    supportOrigin: { x: [324, 324], y: [636, 660] },
  });
  const shifted = resolveForcedTransit(12, { x: 1044, y: 1140 }, transit);
  expect(shifted.windows[0]?.riderOnSupport).toEqual(resolved.windows[0]?.riderOnSupport);
  expect(shifted.windows[0]?.supportOrigin).toEqual({ x: [1044, 1044], y: [996, 1020] });
  expect(shifted.banks[1]).toEqual({ id: "upper", purpose: "forward", width: 72, x: 1128, y: 960 });
});

it("rejects unresolved bank references and reversed coordinate windows", () => {
  expect(() =>
    resolveForcedTransit(12, { x: 0, y: 0 }, { ...transit, boardingBanks: ["missing"] }),
  ).toThrow();
  expect(() =>
    resolveForcedTransit(
      12,
      { x: 0, y: 0 },
      {
        ...transit,
        windows: [{ ...transit.windows[0]!, riderOnSupport: { col: [4, 2], row: [-3, -3] } }],
      },
    ),
  ).toThrow();
});

it("namespaces transit groups without changing local bank references or source instances", () => {
  const instances: Instance[] = [{ character: "lift", col: 27, forcedTransit: transit, row: 65 }];
  const result = namespaceForcedTransit("chunk2", instances);
  expect(result[0]?.forcedTransit?.group).toBe("chunk2:ascent");
  expect(result[0]?.forcedTransit?.boardingBanks).toEqual(["lower"]);
  expect(instances[0]?.forcedTransit?.group).toBe("ascent");
});
