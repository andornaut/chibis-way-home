import { randomStream, shuffled } from "@andornaut/game-kit/random";

import type { AreaPlan, Instance, ThemeBackdrop, ZonePlan } from "../data/types";
import type { ChunkLibrary } from "./assemble";
import { bindElement } from "./elementBinding";

type Span = readonly [number, number];
const planeOf = (layer: Pick<Instance, "parallax">): string =>
  `${layer.parallax?.x ?? 1}:${layer.parallax?.y ?? 1}`;

function authoredSpans(
  characters: ChunkLibrary["characters"],
  required: ReadonlySet<string>,
  area: AreaPlan,
): Span[] {
  const groups = new Map<string, { from: number; to: number; planes: Set<string> }>();
  for (const instance of area.objects) {
    if (instance.backdropSpan) {
      continue;
    }
    const cols = instance.cols ?? characters[instance.character]?.cols;
    if (!cols) {
      continue;
    }
    const key = `${instance.col}:${cols}`;
    const group = groups.get(key) ?? {
      from: Math.max(0, instance.col),
      planes: new Set<string>(),
      to: Math.min(area.cols, instance.col + cols),
    };
    group.planes.add(planeOf(instance));
    groups.set(key, group);
  }
  const spans = [...groups.values()]
    .filter(
      ({ from, planes, to }) => to > from && [...required].every((plane) => planes.has(plane)),
    )
    .map(({ from, to }): Span => [from, to])
    .sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  for (const [from, to] of spans) {
    const last = result.at(-1);
    if (last && from <= last[1]) {
      last[1] = Math.max(last[1], to);
    } else {
      result.push([from, to]);
    }
  }
  return result;
}
function uncoveredParts(covered: readonly Span[], instance: Instance): Instance[] {
  const result: Instance[] = [];
  const end = instance.col + instance.cols!;
  let col = instance.col;
  for (const [from, to] of covered) {
    if (to <= col || from >= end) {
      continue;
    }
    if (from > col) {
      result.push({ ...instance, col, cols: from - col });
    }
    col = Math.max(col, to);
    if (col >= end) {
      break;
    }
  }
  if (col < end) {
    result.push({ ...instance, col, cols: end - col });
  }
  return result;
}

// Background selection has its own stream and only appends nonphysical visual instances.
export function withBackgroundSections(
  library: Pick<ChunkLibrary, "backgrounds" | "characters" | "themes">,
  seed: number,
  stageKey: string,
  themes: Readonly<Record<string, string>>,
  plan: ZonePlan,
): ZonePlan {
  let changed = false;
  const areas = Object.fromEntries(
    Object.entries(plan.areas).map(([areaKey, area]) => {
      const theme = library.themes[themes[areaKey] ?? ""];
      const profile = theme?.background;
      if (!theme || !profile) {
        return [areaKey, area];
      }
      const pool = profile.sections;
      if (!profile.weather.length || !pool.length || new Set(pool).size !== pool.length) {
        throw new Error(`Invalid background profile for ${areaKey}`);
      }
      for (const key of pool) {
        const section = library.backgrounds?.[key];
        if (
          !section ||
          !Number.isSafeInteger(section.cols) ||
          section.cols <= 0 ||
          !section.backdrops.length
        ) {
          throw new Error(`Invalid background section ${key}`);
        }
      }
      const place = (col: number, cols: number, layer: ThemeBackdrop): Instance => {
        const instance = bindElement(theme.bindings, {
          ...layer,
          backdropExtendBottom: true,
          backdropSpan: true,
          col,
          cols,
        });
        if (!library.characters[instance.character]) {
          throw new Error(`No background character ${instance.character}`);
        }
        return instance;
      };
      const required = new Set(
        [...profile.weather, ...pool.flatMap((key) => library.backgrounds![key]!.backdrops)].map(
          (layer) => planeOf(place(0, area.cols, layer)),
        ),
      );
      const protectedSpans = authoredSpans(library.characters, required, area);
      const objects: Instance[] = profile.weather.map((layer) => place(0, area.cols, layer));
      const random = randomStream(seed, `background:${stageKey}:${areaKey}`);
      let col = 0;
      while (col < area.cols) {
        for (const key of shuffled(random, pool)) {
          const section = library.backgrounds![key]!;
          const cols = Math.min(section.cols, area.cols - col);
          objects.push(...section.backdrops.map((layer) => place(col, cols, layer)));
          col += cols;
          if (col === area.cols) {
            break;
          }
        }
      }
      changed = true;
      return [
        areaKey,
        {
          ...area,
          objects: [
            ...area.objects,
            ...objects.flatMap((instance) => uncoveredParts(protectedSpans, instance)),
          ],
        },
      ];
    }),
  );
  return changed ? { ...plan, areas } : plan;
}
