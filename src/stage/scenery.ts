import type { ObjectLayout, Point } from "../data/types/index.ts";

// Static noninteractive sprites may animate in the background without becoming physical actors.
export function sceneryParallax(object: ObjectLayout): Point | undefined {
  const factors = object.parallax;
  if (
    !factors ||
    (factors.x === 1 && factors.y === 1) ||
    object.contact !== undefined ||
    object.orbit !== undefined ||
    (object.quirks?.length ?? 0) > 0 ||
    object.collision !== "none" ||
    object.interaction.kind !== "none" ||
    object.reaction.kind !== "none" ||
    object.motion.algorithm !== "static" ||
    (object.behaviour &&
      Object.values(object.behaviour.states).some(
        (state) => state.motion.kind !== "wait" || (state.onEnter?.length ?? 0) > 0,
      ))
  ) {
    return undefined;
  }
  return factors;
}

// Only collection provenance can select world decorative sprites; their motion never senses Chibi.
export function worldScenery(object: ObjectLayout): boolean {
  const factors = object.parallax ?? { x: 1, y: 1 };
  const behaviour = object.behaviour;
  return (
    object.scenerySource === "chunk" &&
    factors.x === 1 &&
    factors.y === 1 &&
    object.collision === "none" &&
    object.interaction.kind === "none" &&
    object.reaction.kind === "none" &&
    object.contact === undefined &&
    object.orbit === undefined &&
    object.scene === undefined &&
    (object.quirks?.length ?? 0) === 0 &&
    ["static", "linear", "hop"].includes(object.motion.algorithm) &&
    (object.motion.playback === undefined || behaviour === undefined) &&
    (!behaviour ||
      (!behaviour.pursuit &&
        !behaviour.spotted &&
        !behaviour.idleWatchdog &&
        behaviour.attackCooldownSeconds === undefined &&
        Object.values(behaviour.states).every(
          (node) =>
            node.motion.kind === "wait" &&
            node.enter === undefined &&
            node.attack === undefined &&
            (node.onEnter?.length ?? 0) === 0 &&
            node.transitions.every(({ when }) => when.every(({ kind }) => kind === "elapsed")),
        )))
  );
}
