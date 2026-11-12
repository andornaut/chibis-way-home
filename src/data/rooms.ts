import type { RoomPlan } from "./types/index.ts";

// The rooms behind doors, by key. Each room's name is TEXT.rooms[key].name.
export const ROOMS: Readonly<Record<string, RoomPlan>> = {
  "dash-gift": { enter: "dash-gift", grant: "dash" },
  "double-jump-gift": { enter: "double-jump-gift", grant: "doubleJump" },
  "speedy-gift": { enter: "speedy-gift", grant: "speedy" },
  test: {},
};
