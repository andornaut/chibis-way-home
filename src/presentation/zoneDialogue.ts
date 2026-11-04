import { rectsOverlap } from "@andornaut/game-kit/rect";

import type { ObjectLayout, Point, Rect } from "../data/types";
import type { ZoneBark } from "../rules/zone";

// The first object with a behaviour and introduction he is close enough to hear this attempt.
export function proximityDialogue(
  objects: readonly ObjectLayout[],
  positions: readonly Point[],
  heard: ReadonlySet<number>,
  bird: Rect,
): number | undefined {
  const centre = { x: bird.x + bird.width / 2, y: bird.y + bird.height / 2 };
  const index = objects.findIndex((object, index) => {
    const at = positions[index];
    return (
      object.behaviour !== undefined &&
      object.scene !== undefined &&
      !heard.has(index) &&
      at !== undefined &&
      Math.hypot(at.x + object.width / 2 - centre.x, at.y + object.height / 2 - centre.y) <=
        object.interaction.range
    );
  });
  return index < 0 ? undefined : index;
}

// Query the current scene pose by its emitted source identity, never pursuit memory.
export function barkOwnerOnscreen(
  context: { readonly area: string; readonly attempt: number; readonly view: Rect },
  poseOf: (
    objectIndex: number,
  ) => { readonly bounds: Rect; readonly rendered: boolean } | undefined,
  owner: ZoneBark["owner"] | undefined,
): boolean {
  if (
    !owner ||
    owner.area !== context.area ||
    owner.attempt !== context.attempt ||
    !Number.isInteger(owner.objectIndex) ||
    owner.objectIndex < 0
  ) {
    return false;
  }
  const pose = poseOf(owner.objectIndex);
  return pose !== undefined && pose.rendered && rectsOverlap(context.view, pose.bounds);
}
