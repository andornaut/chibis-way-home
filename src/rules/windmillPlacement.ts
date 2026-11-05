import { CHUNK_RULES } from "../data/chunks";
import { MODULE_RULES } from "../data/modules";
import type { CircleOrbit, Instance, Rect } from "../data/types";
import { physicalObjects } from "./chunk";
import { ENCOUNTER_ROLES } from "./modules";
import { orbitBounds, pathLedge } from "./orbit";
import type { Catalogue } from "./tiles";

// The tiles a path ledge's tether sweeps over a turn: from its pivot to the ledge's top centre,
// which circles the pivot radius tiles away, half the ledge's height above its centre.
function tetherSweep(
  pivot: { readonly x: number; readonly y: number },
  radius: number,
  half: number,
): Rect {
  const top = pivot.y - radius - half;
  const bottom = Math.max(pivot.y, pivot.y + radius - half);
  return { height: bottom - top, width: 2 * radius, x: pivot.x - radius, y: top };
}

// Why a chunk or module's windmill sails break the placement rules, if they do: a chunk holding a
// sail (a ledge circling a static host) has no encounter, no encounter-role object and no
// pursuing boss; and no sail's swept bounds or tether comes within the seam footing (4 cols) of a
// module edge (every MODULE_RULES.cols from its left edge to its right), so it stays clear of each
// seam's footing and the 6 rows of headroom above it.
export function windmillPlacementProblems(
  catalogue: Catalogue,
  chunk: {
    readonly backdrops?: readonly Instance[];
    readonly cols: number;
    readonly encounters: number;
    readonly objects: readonly Instance[];
  },
): string[] {
  const instances = [...(chunk.backdrops ?? []), ...chunk.objects];
  if (!instances.some((instance) => instance.orbit)) {
    return [];
  }
  const objects = physicalObjects(catalogue, instances);
  const sails = objects.flatMap((object, index) =>
    pathLedge(object) && object.orbit!.kind === "circle"
      ? [{ instance: instances[index]!, object }]
      : [],
  );
  if (sails.length === 0) {
    return [];
  }
  const problems: string[] = [];
  if (chunk.encounters !== 0) {
    problems.push(`windmill with ${chunk.encounters} encounters`);
  }
  for (const instance of chunk.objects) {
    const behaviour = instance.behaviour ?? catalogue.characters[instance.character]?.behaviour;
    if (instance.role !== undefined && ENCOUNTER_ROLES.has(instance.role)) {
      problems.push(`windmill beside ${instance.role} ${instance.character}`);
    } else if (behaviour?.pursuit) {
      problems.push(`windmill beside pursuing ${instance.character}`);
    }
  }
  for (const { instance, object } of sails) {
    const orbit = object.orbit as CircleOrbit<number>;
    const host = objects[orbit.host]!;
    const pivot = { x: host.origin.x + host.width / 2, y: host.origin.y + host.height / 2 };
    const footprints: [string, Rect][] = [["bounds", orbitBounds(objects, object)]];
    if (instance.tether) {
      footprints.push(["tether", tetherSweep(pivot, orbit.radius, object.height / 2)]);
    }
    problems.push(...moduleEdgeProblems(chunk.cols, instance, footprints));
  }
  return problems;
}

// Why named footprints of instance come within the seam footing (4 cols) of a module edge (every
// MODULE_RULES.cols from a chunk's left edge to its right, cols wide), if they do.
export function moduleEdgeProblems(
  cols: number,
  instance: Instance,
  footprints: readonly (readonly [string, Rect])[],
): string[] {
  const { footing } = CHUNK_RULES;
  const edges = Array.from(
    { length: Math.floor(cols / MODULE_RULES.cols) + 1 },
    (_, index) => index * MODULE_RULES.cols,
  );
  return footprints.flatMap(([name, rect]) => {
    const where = `${instance.character} at col ${instance.col} ${name}`;
    return edges
      .filter((at) => rect.x < at + footing && rect.x + rect.width > at - footing)
      .map((edge) => `${where} within ${footing} cols of the module edge at col ${edge}`);
  });
}
