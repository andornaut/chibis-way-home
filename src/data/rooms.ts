import type { RoomPlan } from "./types/index.ts";

// The rooms behind doors, by key. Each room's name is TEXT.rooms[key].name.
export const ROOMS: Readonly<Record<string, RoomPlan>> = {
  "dash-gift": { conversation: "mallow-gift", enter: "dash-gift", grant: "dash" },
  "double-jump-gift": {
    conversation: "mallow-gift",
    enter: "double-jump-gift",
    grant: "doubleJump",
  },
  "speedy-gift": { conversation: "mallow-gift", enter: "speedy-gift", grant: "speedy" },
  test: {},
};
