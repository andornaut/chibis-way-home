import { BIRD } from "./bird";
import { GANTRY_DISTANCE } from "./obstacleBehaviours";
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

const GANTRY_COLS = 6;
const GANTRY_BANK_COLS = 4;
// The container's travel from a dock within which stepping off reaches that dock's bank.
const GANTRY_DOCK_COLS = 2;
const GANTRY_RIDER = {
  col: [-BIRD.width / TILE, GANTRY_COLS],
  row: [-RIDER_ROWS, -RIDER_ROWS],
} as const;

// The gantry crane ride, placed at the near dock with its lid level with both banks: boarded from
// the near dock, forced over the pit, left at the far dock.
export const GANTRY_RIDE_TRANSIT = {
  banks: [
    { col: -GANTRY_BANK_COLS, cols: GANTRY_BANK_COLS, id: "dock", purpose: "retreat", row: 0 },
    {
      col: GANTRY_DISTANCE + GANTRY_COLS,
      cols: GANTRY_BANK_COLS,
      id: "far",
      purpose: "forward",
      row: 0,
    },
  ],
  boardingBanks: ["dock"],
  group: "gantry",
  leg: "forward",
  windows: [
    {
      certification: "ordinary",
      result: { bankId: "dock", kind: "egress" },
      riderOnSupport: GANTRY_RIDER,
      supportOrigin: { col: [0, GANTRY_DOCK_COLS], row: [0, 0] },
    },
    {
      certification: "ordinary",
      result: { kind: "forced" },
      riderOnSupport: GANTRY_RIDER,
      supportOrigin: { col: [0, GANTRY_DISTANCE], row: [0, 0] },
    },
    {
      certification: "ordinary",
      result: { bankId: "far", kind: "egress" },
      riderOnSupport: GANTRY_RIDER,
      supportOrigin: { col: [GANTRY_DISTANCE - GANTRY_DOCK_COLS, GANTRY_DISTANCE], row: [0, 0] },
    },
  ],
} as const satisfies ForcedTransit;
