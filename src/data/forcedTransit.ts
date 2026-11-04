import { BIRD } from "./bird";
import { TILE } from "./screen";
import type { ForcedTransit } from "./types";

const RIDER_ROWS = BIRD.height / TILE;

export const OUTDOOR_LIFT_ASCENT_TRANSIT = {
  banks: [
    { col: -7, cols: 6, id: "lower", purpose: "retreat", row: 0 },
    { col: 7, cols: 6, id: "upper", purpose: "forward", row: -15 },
  ],
  boardingBanks: ["lower"],
  group: "ascent",
  leg: "forward",
  windows: [
    {
      certification: "ordinary",
      result: { bankId: "lower", kind: "egress" },
      riderOnSupport: { col: [-2, 5], row: [-RIDER_ROWS, -RIDER_ROWS] },
      supportOrigin: { col: [0, 0], row: [-2, 0] },
    },
    {
      certification: "ordinary",
      result: { kind: "forced" },
      riderOnSupport: { col: [-2, 5], row: [-RIDER_ROWS, -RIDER_ROWS] },
      supportOrigin: { col: [0, 0], row: [-7, 0] },
    },
    {
      certification: "ordinary",
      result: { bankId: "upper", kind: "egress" },
      riderOnSupport: { col: [0.5, 5], row: [-RIDER_ROWS, -RIDER_ROWS] },
      supportOrigin: { col: [0, 0], row: [-12, -10] },
    },
  ],
} as const satisfies ForcedTransit;
