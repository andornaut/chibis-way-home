import { ROOM_BUILDING_DOOR, ROOM_BUILDING_OPENING, ROOM_BUILDINGS } from "../data/roomBuildings";
import type { Instance, TerrainRect, ZonePlan } from "../data/types";
import type { ChunkLibrary } from "./assemble";

function unsupportedBase(
  solids: readonly TerrainRect[],
  row: number,
  from: number,
  to: number,
): number | undefined {
  const spans = solids
    .filter((solid) => solid.row <= row && solid.row + solid.rows > row)
    .map((solid) => [solid.col, solid.col + solid.cols] as const)
    .sort((a, b) => a[0] - b[0]);
  let covered = from;
  for (const [left, right] of spans) {
    if (left > covered) {
      break;
    }
    covered = Math.max(covered, right);
    if (covered >= to) {
      return undefined;
    }
  }
  return covered;
}

export function withRoomBuildings(
  library: Pick<ChunkLibrary, "characters">,
  themes: Readonly<Record<string, string>>,
  plan: ZonePlan,
): ZonePlan {
  let changed = false;
  const areas = Object.fromEntries(
    Object.entries(plan.areas).map(([key, area]) => {
      const character = ROOM_BUILDINGS[themes[key] ?? ""];
      if (!character) {
        return [key, area];
      }
      const doors = area.objects.filter(
        (object) => object.character === ROOM_BUILDING_DOOR && object.room !== undefined,
      );
      if (!doors.length) {
        return [key, area];
      }
      const size = library.characters[character];
      const doorSize = library.characters[ROOM_BUILDING_DOOR];
      const opening = ROOM_BUILDING_OPENING;
      if (
        !size ||
        !doorSize ||
        opening.col + opening.cols > size.cols ||
        opening.row + opening.rows !== size.rows
      ) {
        throw new Error(`Invalid room building opening for ${character}`);
      }
      const buildings = doors.map((door): Instance => {
        if (
          (door.cols ?? doorSize.cols) !== opening.cols ||
          (door.rows ?? doorSize.rows) !== opening.rows
        ) {
          throw new Error(
            `Room building requires the ordinary door size at ${key}:${door.col},${door.row}`,
          );
        }
        const col = door.col - opening.col;
        const row = door.row - opening.row;
        const bottom = row + size.rows;
        if (col < 0 || row < 0 || col + size.cols > area.cols || bottom > area.rows) {
          throw new Error(`Room building exceeds area ${key} at ${col},${row}`);
        }
        const gap = unsupportedBase(area.solids, bottom, col, col + size.cols);
        if (gap !== undefined) {
          const chunk = area.chunks?.find(
            (part) => door.col >= part.col && door.col < part.col + part.cols,
          )?.chunk;
          throw new Error(
            `Unsupported room building ${themes[key]}:${chunk ?? key} door ${door.col},${door.row}; ` +
              `base ${col}..${col + size.cols} row ${bottom}, gap at ${gap}`,
          );
        }
        return { character, col, parallax: { x: 1, y: 1 }, row };
      });
      changed = true;
      return [
        key,
        {
          ...area,
          objects: [...area.objects, ...buildings],
          sceneryIndices: [
            ...(area.sceneryIndices ?? []),
            ...buildings.map((_, index) => area.objects.length + index),
          ],
        },
      ];
    }),
  );
  return changed ? { ...plan, areas } : plan;
}
