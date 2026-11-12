import type { ObjectLayout, Point, Rect } from "../data/types/index.ts";
import type { BehaviourWorld } from "../rules/behaviourReach.ts";
import { targetVisible } from "../rules/perception.ts";
import { type Transient, transientBox } from "../rules/transients.ts";

export interface ObservedProjectile {
  readonly emitter: number;
  readonly gravity: number;
  readonly id: number;
  readonly rect: Readonly<Rect>;
  readonly velocity: Readonly<Point>;
}

export type ProjectileObservation =
  | { readonly kind: "known"; readonly projectiles: readonly ObservedProjectile[] }
  | { readonly kind: "unknown"; readonly problem: string };

export type ProjectileGravityModel =
  | { readonly gravity: number; readonly kind: "known" }
  | { readonly kind: "unknown"; readonly problem: string };

export type ProjectileGravityByEmitter = ReadonlyMap<
  number,
  ReadonlyMap<string, ProjectileGravityModel>
>;

// Resolved spawn actions define the publicly known motion models, independently of live state.
export function projectileGravityModels(
  emitters: readonly Pick<ObjectLayout, "behaviour">[],
): ProjectileGravityByEmitter {
  return new Map(
    emitters.map(({ behaviour }, emitter) => {
      const models = new Map<string, ProjectileGravityModel>();
      for (const state of Object.values(behaviour?.states ?? {})) {
        for (const action of state.onEnter ?? []) {
          if (action.kind !== "spawn") {
            continue;
          }
          const previous = models.get(action.character);
          if (previous?.kind === "unknown") {
            continue;
          }
          if (!Number.isFinite(action.gravity) || action.gravity < 0) {
            models.set(action.character, {
              kind: "unknown",
              problem: `Emitter ${emitter} has an invalid public gravity for ${action.character}`,
            });
          } else if (previous && previous.gravity !== action.gravity) {
            models.set(action.character, {
              kind: "unknown",
              problem: `Emitter ${emitter} has ambiguous public gravity for ${action.character}`,
            });
          } else {
            models.set(action.character, { gravity: action.gravity, kind: "known" });
          }
        }
      }
      return [emitter, models] as const;
    }),
  );
}

export interface ProjectileObservationContext {
  readonly gravityByEmitter: ProjectileGravityByEmitter;
  readonly observer: Rect;
  readonly world: Pick<BehaviourWorld, "platforms" | "solids" | "view">;
}

// The caller delays this entire detached observation alongside its matching boss sample.
export function observeProjectiles(
  { gravityByEmitter, observer, world }: ProjectileObservationContext,
  entities: readonly Transient[],
): ProjectileObservation {
  const projectiles: ObservedProjectile[] = [];
  for (const entity of entities) {
    if (entity.age < entity.armSeconds) {
      continue;
    }
    const rect = transientBox(entity);
    if (!targetVisible(world, undefined, observer, rect)) {
      continue;
    }
    const model = gravityByEmitter.get(entity.emitter)?.get(entity.object.character);
    if (!model) {
      return {
        kind: "unknown",
        problem: `Emitter ${entity.emitter} has no public gravity for ${entity.object.character}`,
      };
    }
    if (model.kind === "unknown") {
      return { kind: "unknown", problem: model.problem };
    }
    projectiles.push({
      emitter: entity.emitter,
      gravity: model.gravity,
      id: entity.id,
      rect: { ...rect },
      velocity: { ...entity.velocity },
    });
  }
  return { kind: "known", projectiles };
}
