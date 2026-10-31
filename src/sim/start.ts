import type { BirdTuning, ZoneLayout } from "../data/types";
import { contactBox } from "../rules/behaviour";
import { birdBox } from "../rules/bird";
import { overlaps } from "../rules/rect";
import { areaOf, type ZoneState } from "../rules/zone";

export type SimulationStart =
  | { readonly area: string; readonly entry: string }
  | { readonly area: string; readonly x: number; readonly y: number };

// A simulation-only entry uses the real area initializer, including initial actor headings.
export function layoutAtStart(
  tuning: BirdTuning,
  layout: ZoneLayout,
  start: SimulationStart | undefined,
): ZoneLayout {
  if (start === undefined) {
    return layout;
  }
  const area = areaOf(layout, start.area);
  if ("entry" in start) {
    if (!area.entries[start.entry]) {
      throw new Error(`No entry ${start.entry}`);
    }
    return { ...layout, start: { area: start.area, entry: start.entry } };
  }
  if (![start.x, start.y].every(Number.isFinite)) {
    throw new Error("Invalid simulation start");
  }
  const entry = "__simulation_start__";
  return {
    ...layout,
    areas: {
      ...layout.areas,
      [start.area]: {
        ...area,
        entries: {
          ...area.entries,
          [entry]: { x: start.x + tuning.width / 2, y: start.y + tuning.height },
        },
      },
    },
    start: { area: start.area, entry },
  };
}

export function validateStart(tuning: BirdTuning, layout: ZoneLayout, zone: ZoneState): void {
  const area = areaOf(layout, zone.area);
  const box = birdBox(tuning, zone.bird);
  if (
    box.x < area.backX ||
    box.x + box.width > area.exitX ||
    box.y < 0 ||
    box.y + box.height > area.height ||
    area.solids.some((solid) => overlaps(box, solid))
  ) {
    throw new Error("Simulation start is outside playable bounds or inside terrain");
  }
  const unsafe = area.objects.some((object, index) => {
    if (object.collision !== "solid" && object.collision !== "hazard") {
      return false;
    }
    const at = zone.objects[index] ?? object.origin;
    const rect =
      object.collision === "hazard"
        ? contactBox(object, at, zone.behaviours[index]?.facing ?? 1, zone.behaviours[index]?.axis)
        : { ...at, height: object.height, width: object.width };
    return overlaps(box, rect);
  });
  if (unsafe) {
    throw new Error("Simulation start overlaps a solid object or hazard");
  }
}
