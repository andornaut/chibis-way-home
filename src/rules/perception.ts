import { CAMERA } from "../data/camera";
import { SCREEN } from "../data/screen";
import type { AreaLayout, BirdTuning, ObjectLayout, Point, Rect } from "../data/types";
import { cameraScroll } from "../view/camera";
import type { BehaviourWorld } from "./behaviourReach";
import type { BirdState } from "./bird";

export function currentScreen(tuning: BirdTuning, area: AreaLayout, bird: BirdState): Rect {
  return {
    ...SCREEN,
    ...cameraScroll(CAMERA, SCREEN, area, {
      x: bird.x + tuning.width / 2,
      y: bird.y + tuning.height,
    }),
  };
}

function crosses(rect: Rect, from: Point, to: Point): boolean {
  let near = 0;
  let far = 1;
  for (const [axis, size] of [
    ["x", "width"],
    ["y", "height"],
  ] as const) {
    const delta = to[axis] - from[axis];
    if (delta === 0) {
      if (from[axis] < rect[axis] || from[axis] > rect[axis] + rect[size]) {
        return false;
      }
      continue;
    }
    const first = (rect[axis] - from[axis]) / delta;
    const last = (rect[axis] + rect[size] - from[axis]) / delta;
    near = Math.max(near, Math.min(first, last));
    far = Math.min(far, Math.max(first, last));
    if (near > far) {
      return false;
    }
  }
  return far > 0 && near < 1;
}

// Ledges do not occlude sight. The observer's own solid body never blocks its view.
export function targetVisible(
  world: BehaviourWorld,
  observer: Rect,
  target: Rect,
  owner?: ObjectLayout,
): boolean {
  const centre = (rect: Rect): Point => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  });
  const from = centre(observer);
  const to = centre(target);
  const view = world.view;
  const inside = (point: Point) =>
    view !== undefined &&
    point.x >= view.x &&
    point.x < view.x + view.width &&
    point.y >= view.y &&
    point.y < view.y + view.height;
  return (
    inside(from) &&
    inside(to) &&
    !world.solids.some((rect) => crosses(rect, from, to)) &&
    !(world.platforms ?? []).some(
      (platform) =>
        platform.collision === "solid" &&
        platform.owner !== owner &&
        crosses(platform.rect, from, to),
    )
  );
}
