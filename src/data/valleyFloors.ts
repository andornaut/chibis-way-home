import { ZONE_ROWS } from "./screen";
import type { ChunkPlan, Instance, TerrainRect } from "./types";

const VALLEY_DEPTH = 8;

// Close bottom-open production terrain without changing the existing route or object indices.
export function withValleyFloors(chunk: ChunkPlan): ChunkPlan {
  const themes = typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
  if (themes.every((theme) => theme === "park")) {
    return chunk;
  }
  const height = chunk.rows ?? ZONE_ROWS;
  const ground = chunk.solids.filter(({ row, rows }) => row + rows === height);
  const gaps: { col: number; cols: number }[] = [];
  let start: number | undefined;
  for (let col = 0; col <= chunk.cols; col++) {
    const covered =
      col < chunk.cols && ground.some((solid) => solid.col <= col && solid.col + solid.cols > col);
    if (col < chunk.cols && !covered) {
      start ??= col;
    } else if (start !== undefined) {
      gaps.push({ col: start, cols: col - start });
      start = undefined;
    }
  }
  if (gaps.length === 0) {
    return chunk;
  }
  const floors: TerrainRect[] = [];
  const hazards: Instance[] = [];
  for (const gap of gaps) {
    const red = chunk.objects.filter(
      (object) =>
        object.role === "edge-top" &&
        !object.orbit &&
        !object.behaviour &&
        object.col <= gap.col &&
        object.col + (object.cols ?? 1) >= gap.col + gap.cols,
    );
    const authored = red.length ? Math.max(...red.map(({ row }) => row + 1)) : undefined;
    const banks = ground.filter(
      (solid) => solid.col + solid.cols === gap.col || solid.col === gap.col + gap.cols,
    );
    const lowerBank = banks.length
      ? Math.max(...banks.map(({ row }) => row))
      : Math.max(...chunk.solids.map(({ row }) => row));
    const depth = gap.col > 0 && gap.col + gap.cols < chunk.cols ? VALLEY_DEPTH : 0;
    const row = authored ?? Math.min(height - 1, lowerBank + (banks.length ? depth : VALLEY_DEPTH));
    floors.push({ col: gap.col, cols: gap.cols, look: "ground", row, rows: height - row });
    if (authored === undefined) {
      hazards.push({
        character: "red-edge-top",
        col: gap.col,
        cols: gap.cols,
        role: "edge-top",
        row: row - 1,
      });
    }
  }
  return {
    ...chunk,
    objects: [...chunk.objects, ...hazards],
    solids: [...chunk.solids, ...floors],
  };
}
