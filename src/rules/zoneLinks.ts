import type { AreaLink, BirdTuning, ZoneLayout } from "../data/types/index.ts";

const VALIDATED = new WeakSet<ZoneLayout>();

// Layouts are immutable. Resolve graph errors once before play, never in the physics hot path.
export function validateZoneLinks(layout: ZoneLayout): void {
  if (VALIDATED.has(layout)) {
    return;
  }
  const target = ({ area, entry }: AreaLink) => {
    if (!layout.areas[area]?.entries[entry]) {
      throw new Error(`Invalid walk target ${area}:${entry}`);
    }
  };
  target(layout.start);
  for (const area of Object.values(layout.areas)) {
    if (area.walkLinks?.left) {
      target(area.walkLinks.left);
    }
    if (area.walkLinks?.right) {
      target(area.walkLinks.right);
    }
  }
  const order = layout.areaOrder;
  if (order) {
    if (
      order.length === 0 ||
      new Set(order).size !== order.length ||
      order.length !== Object.keys(layout.areas).length ||
      order.some((id) => !layout.areas[id])
    ) {
      throw new Error("Area order must contain every area exactly once");
    }
    order.forEach((id, index) => {
      const links = layout.areas[id]?.walkLinks;
      if (links?.left?.area !== order[index - 1] || links?.right?.area !== order[index + 1]) {
        throw new Error(`Walk links do not follow area order at ${id}`);
      }
    });
  }
  VALIDATED.add(layout);
}

export function validateWalkEntries(
  tuning: Pick<BirdTuning, "width" | "height">,
  layout: ZoneLayout,
): void {
  validateZoneLinks(layout);
  for (const source of Object.values(layout.areas)) {
    for (const link of [source.walkLinks?.left, source.walkLinks?.right]) {
      if (!link) {
        continue;
      }
      const area = layout.areas[link.area];
      const entry = area?.entries[link.entry];
      if (
        !area ||
        !entry ||
        entry.x - tuning.width / 2 < area.backX ||
        entry.x + tuning.width / 2 > area.exitX ||
        entry.y - tuning.height < 0 ||
        entry.y > area.height
      ) {
        throw new Error(
          `Walk entry ${link.area}:${link.entry} overlaps an edge trigger or area bounds`,
        );
      }
    }
  }
}
