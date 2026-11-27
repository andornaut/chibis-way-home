import { expect, it } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { ROOMS } from "../data/rooms.ts";
import { giftDraw, prepareGift } from "./gifts.ts";

it.each([ZONE_MAP.destinations[0]!, ZONE_MAP.destinations.at(-1)!])(
  "draws distinct gifts and stages reproducibly for $id",
  (destination) => {
    const draw = giftDraw(destination, 37);
    expect([...draw]).toEqual([...giftDraw(destination, 37)]);
    expect(draw.size).toBe(destination.giftCount);
    expect(new Set(draw.values()).size).toBe(destination.giftCount);
    expect([...draw.keys()].every((stage) => destination.stages.includes(stage))).toBe(true);
    expect(
      destination.stages
        .map((stage) => prepareGift(ZONE_MAP, ROOMS, null, stage, 37)?.giftRoom)
        .filter((room) => room !== null),
    ).toHaveLength(destination.giftCount);
  },
);
