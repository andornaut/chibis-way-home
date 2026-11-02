import { ROOMS } from "../data/rooms";
import { ALL_CHUNKS, FIXTURE_RECIPE } from "./chunks";

const ROOM_FILL = "test";
if (!(ROOM_FILL in ROOMS)) {
  throw new Error(`Missing filled-slot room ${ROOM_FILL}`);
}
const EVENT_FILL = FIXTURE_RECIPE.events[0]!.id;

export const FILLED_CHUNK_SLOTS: Readonly<
  Record<string, { readonly door: readonly string[]; readonly event: readonly string[] }>
> = Object.fromEntries(
  ALL_CHUNKS.filter(([, , chunk]) => (chunk.slots?.length ?? 0) > 0).map(([name, , chunk]) => [
    name,
    {
      door: chunk.slots!.filter(({ kind }) => kind === "door").map(() => ROOM_FILL),
      event: chunk.slots!.filter(({ kind }) => kind === "event").map(() => EVENT_FILL),
    },
  ]),
);
