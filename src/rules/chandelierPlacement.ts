import { MODULE_RULES } from "../data/modules";
import type { Instance, PendulumOrbit, Point, Rect } from "../data/types";
import { physicalObjects } from "./chunk";
import { ENCOUNTER_ROLES } from "./modules";
import { orbitBounds, pathLedge } from "./orbit";
import type { Catalogue } from "./tiles";
import { moduleEdgeProblems } from "./windmillPlacement";

// The tiles a swinging ledge's tether sweeps: from its pivot to the ledge's top centre, which
// swings length tiles below the pivot, half the ledge's height above its centre, highest at the
// arc's ends.
function chainSweep(pivot: Point, orbit: PendulumOrbit<number>, half: number): Rect {
  const reach = orbit.length * Math.sin(orbit.amplitude);
  const top = Math.min(pivot.y, pivot.y + orbit.length * Math.cos(orbit.amplitude) - half);
  return {
    height: pivot.y + orbit.length - half - top,
    width: 2 * reach,
    x: pivot.x - reach,
    y: top,
  };
}

// Why a chunk or module's chandeliers break the placement rules, if they do: no chandelier (a
// ledge swinging below a static host) shares its module (the MODULE_RULES.cols span its arc lies
// in) with an encounter-role object or a pursuing boss, which the paired module may hold; and no
// chandelier's arc bounds or chain comes within the seam footing (4 cols) of a module edge, so it
// stays clear of each seam's footing and the 6 rows of headroom above it.
export function chandelierPlacementProblems(
  catalogue: Catalogue,
  chunk: {
    readonly backdrops?: readonly Instance[];
    readonly cols: number;
    readonly objects: readonly Instance[];
  },
): string[] {
  const instances = [...(chunk.backdrops ?? []), ...chunk.objects];
  if (!instances.some((instance) => instance.orbit?.kind === "pendulum")) {
    return [];
  }
  const objects = physicalObjects(catalogue, instances);
  const problems: string[] = [];
  objects.forEach((object, index) => {
    if (!pathLedge(object) || object.orbit!.kind !== "pendulum") {
      return;
    }
    const orbit = object.orbit as PendulumOrbit<number>;
    const instance = instances[index]!;
    const bounds = orbitBounds(objects, object);
    const left = Math.floor(bounds.x / MODULE_RULES.cols) * MODULE_RULES.cols;
    for (const other of chunk.objects) {
      if (other.col < left || other.col >= left + MODULE_RULES.cols) {
        continue;
      }
      const behaviour = other.behaviour ?? catalogue.characters[other.character]?.behaviour;
      if (other.role !== undefined && ENCOUNTER_ROLES.has(other.role)) {
        problems.push(`chandelier module beside ${other.role} ${other.character}`);
      } else if (behaviour?.pursuit) {
        problems.push(`chandelier module beside pursuing ${other.character}`);
      }
    }
    const host = objects[orbit.host]!;
    const pivot = { x: host.origin.x + host.width / 2, y: host.origin.y + host.height / 2 };
    const footprints: [string, Rect][] = [["bounds", bounds]];
    if (instance.tether) {
      footprints.push(["tether", chainSweep(pivot, orbit, object.height / 2)]);
    }
    problems.push(...moduleEdgeProblems(chunk.cols, instance, footprints));
  });
  return problems;
}
