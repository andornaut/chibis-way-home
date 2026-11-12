import type { ChunkPlan, ZonePlan, ZoneRecipe } from "../data/types/index.ts";

export function chunkRows(context: { readonly rows: number }, chunk: ChunkPlan): number {
  return chunk.rows ?? context.rows;
}

export function validRows(rows: number): boolean {
  return Number.isSafeInteger(rows) && rows > 0;
}

// Spawn rows and finish-cap exits use authored coordinates; neither changes terrain or seams.
export function applyStageGeometry(
  options: Pick<ZoneRecipe, "rows" | "spawnRow" | "stageExit">,
  plan: ZonePlan,
): ZonePlan {
  const start = plan.areas[plan.start.area];
  if (
    !start ||
    !validRows(start.rows) ||
    (options.rows !== undefined && options.rows !== start.rows)
  ) {
    throw new Error("Stage height must match its authored chunks");
  }
  let areas = plan.areas;
  if (options.spawnRow !== undefined) {
    const row = options.spawnRow;
    const entry = start.entries[plan.start.entry];
    const opening = start.chunks?.[0];
    if (
      !Number.isSafeInteger(row) ||
      row <= 0 ||
      row > start.rows ||
      !entry ||
      !opening ||
      !start.solids.some(
        (solid) =>
          solid.row === row &&
          solid.col <= entry.col &&
          entry.col < solid.col + solid.cols &&
          solid.col < opening.cols,
      )
    ) {
      throw new Error("Spawn row must stand on authored opening-cap terrain inside its height");
    }
    areas = {
      ...areas,
      [plan.start.area]: {
        ...start,
        entries: { ...start.entries, [plan.start.entry]: { ...entry, row } },
      },
    };
  }
  if (!options.stageExit) {
    return { ...plan, areas };
  }
  const area = plan.areaOrder?.at(-1) ?? plan.start.area;
  const finish = areas[area];
  const cap = finish?.chunks?.at(-1);
  const rect = options.stageExit;
  if (
    !finish ||
    !cap ||
    ![rect.col, rect.cols, rect.row, rect.rows].every(Number.isFinite) ||
    rect.col < 0 ||
    rect.row < 0 ||
    rect.cols <= 0 ||
    rect.rows <= 0 ||
    rect.col + rect.cols > cap.cols ||
    rect.row + rect.rows > finish.rows
  ) {
    throw new Error("Stage exit must fit inside its authored final cap");
  }
  return { ...plan, areas, stageExit: { area, rect: { ...rect, col: rect.col + cap.col } } };
}
