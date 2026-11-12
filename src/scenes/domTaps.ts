import { readUnit } from "@andornaut/game-kit/web/ui/dom/viewUnits";

import { TOUCH } from "../data/touch.ts";
import type { SceneInput } from "./modalInput.ts";

// Fresh taps on an HTML UI view's controls: a press that lands on a control, never travels past
// the tap distance and lifts on the same control, under the modal input captured when it landed,
// so a tap never crosses a stack change. One press is followed at a time, by its own pointer:
// another finger down meanwhile leaves it alone. A drag, a cancel or a lift off the control taps
// nothing. Lifts and moves are read on the whole page, so a press released elsewhere never holds.

export interface TapRoute<Control> {
  // The control a pointer's event is on, or null where it is on none of the view's.
  controlAt(event: PointerEvent): Control | null;
  // Whether a press may land now, before the modal input's own check.
  readonly accepts?: () => boolean;
  // Called as a press lands on control and is followed.
  readonly land?: (control: Control) => void;
  // Shows the control the followed press holds, or none (undefined) once it lifts or travels.
  readonly show?: (control: Control | undefined) => void;
  tap(control: Control): void;
}

// Where a view's presses land: target, its element or the page for a view that takes no presses
// itself, and view, an element in the view, whose --ui-unit sets the tap distance. preventDefault
// on a press landing on a control keeps the keyboard's focus where it is and holds back the
// mouse events it would send.
export interface TapTarget {
  readonly preventDefault: boolean;
  readonly target: EventTarget;
  readonly view: Element;
}

// Follows taps for route, landing on at, under input. Returns a function that removes the
// listeners.
export function followTaps<Control>(
  at: TapTarget,
  input: SceneInput,
  route: TapRoute<Control>,
): () => void {
  const document = at.view.ownerDocument;
  let press:
    | {
        readonly check: () => boolean;
        readonly control: Control;
        readonly pointerId: number;
        readonly unit: number;
        readonly x: number;
        readonly y: number;
        travelled: boolean;
      }
    | undefined;
  const release = () => {
    if (press !== undefined) {
      press = undefined;
      route.show?.(undefined);
    }
  };
  const travelled = (event: PointerEvent) =>
    press !== undefined &&
    Math.hypot(event.clientX - press.x, event.clientY - press.y) >
      TOUCH.tapMaxDistance * press.unit;
  const onDown = (event: PointerEvent) => {
    const control = route.controlAt(event);
    if (control === null) {
      return;
    }
    if (at.preventDefault) {
      event.preventDefault();
    }
    // A touch is captured by what it lands on; released, its lift is on what it lifts over.
    const { pointerId, target } = event;
    if (target instanceof Element && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    if (press !== undefined || route.accepts?.() === false || !input.accepts()) {
      return;
    }
    press = {
      check: input.capture(),
      control,
      pointerId,
      travelled: false,
      unit: readUnit(at.view),
      x: event.clientX,
      y: event.clientY,
    };
    route.land?.(control);
    route.show?.(control);
  };
  const onMove = (event: PointerEvent) => {
    if (press?.pointerId !== event.pointerId || press.travelled || !travelled(event)) {
      return;
    }
    press.travelled = true;
    route.show?.(undefined);
  };
  const onEnd = (event: PointerEvent) => {
    const held = press;
    if (held?.pointerId !== event.pointerId) {
      return;
    }
    const tapped =
      event.type === "pointerup" &&
      !held.travelled &&
      !travelled(event) &&
      route.controlAt(event) === held.control &&
      route.accepts?.() !== false &&
      held.check();
    release();
    if (tapped) {
      route.tap(held.control);
    }
  };
  input.subscribe(release);
  at.target.addEventListener("pointerdown", onDown as EventListener, true);
  document.addEventListener("pointermove", onMove, true);
  document.addEventListener("pointerup", onEnd, true);
  document.addEventListener("pointercancel", onEnd, true);
  return () => {
    release();
    at.target.removeEventListener("pointerdown", onDown as EventListener, true);
    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("pointerup", onEnd, true);
    document.removeEventListener("pointercancel", onEnd, true);
  };
}
