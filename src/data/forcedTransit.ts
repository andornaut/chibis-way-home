import { BIRD } from "./bird";
import { TILE } from "./screen";
import type { ForcedTransit } from "./types";

const RIDER_ROWS = BIRD.height / TILE;

export const CITY_BOUNDARY_SHUTTLE_TRANSIT = {
  banks: [
    { col: -10, cols: 8, id: "near", purpose: "retreat", row: 0 },
    { col: 20, cols: 30, id: "far", purpose: "forward", row: 0 },
  ],
  boardingBanks: ["near"],
  group: "crossing",
  leg: "forward",
  windows: [
    {
      certification: "uncertified",
      result: { bankId: "far", kind: "egress" },
      riderOnSupport: { col: [2, 4], row: [-RIDER_ROWS, -RIDER_ROWS] },
      supportOrigin: { col: [14, 14], row: [0, 0] },
    },
  ],
} as const satisfies ForcedTransit;

export const OUTDOOR_FERRY_ASCENT_TRANSIT = {
  banks: [
    { col: -6, cols: 6, id: "near", purpose: "retreat", row: 0 },
    { col: 22, cols: 6, id: "far", purpose: "forward", row: 0 },
  ],
  boardingBanks: ["near"],
  group: "crossing",
  leg: "forward",
  windows: [
    {
      certification: "uncertified",
      result: { bankId: "far", kind: "egress" },
      riderOnSupport: { col: [2, 4], row: [-RIDER_ROWS, -RIDER_ROWS] },
      supportOrigin: { col: [16, 16], row: [0, 0] },
    },
  ],
} as const satisfies ForcedTransit;

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
