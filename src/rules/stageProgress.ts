import type { BirdTuning, ZoneLayout } from "../data/types/index.ts";
import { attemptProgress } from "./death.ts";
import type { ZoneState } from "./zone.ts";

interface SectionProgress {
  readonly offset: number;
  readonly origin: number;
  readonly width: number;
}
const CACHE = new WeakMap<
  ZoneLayout,
  { sections: ReadonlyMap<string, SectionProgress>; total: number }
>();

export function stageProgress(
  tuning: Pick<BirdTuning, "width">,
  layout: ZoneLayout,
  zone: Pick<ZoneState, "area" | "bird" | "cleared">,
): number {
  if (zone.cleared) {
    return 1;
  }
  if (!layout.areaOrder) {
    const area = layout.areas[zone.area];
    const entry = layout.areas[layout.start.area]?.entries[layout.start.entry];
    if (!area || !entry) {
      throw new Error("Missing stage progress origin");
    }
    return attemptProgress(entry.x, area.exitX, zone.bird.x + tuning.width / 2);
  }
  let cached = CACHE.get(layout);
  if (!cached) {
    const sections = new Map<string, SectionProgress>();
    let total = 0;
    for (const id of layout.areaOrder) {
      const area = layout.areas[id];
      if (!area) {
        throw new Error(`Missing progress area ${id}`);
      }
      const origin = area.entries.start?.x ?? area.backX;
      const width = area.exitX - origin;
      if (!Number.isFinite(origin) || !Number.isFinite(width) || width <= 0) {
        throw new Error(`Invalid progress bounds for ${id}`);
      }
      sections.set(id, { offset: total, origin, width });
      total += width;
    }
    cached = { sections, total };
    CACHE.set(layout, cached);
  }
  const section = cached.sections.get(zone.area);
  if (!section) {
    throw new Error(`Area ${zone.area} is absent from stage order`);
  }
  return (
    (section.offset +
      Math.max(0, Math.min(section.width, zone.bird.x + tuning.width / 2 - section.origin))) /
    cached.total
  );
}
