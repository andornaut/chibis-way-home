import type { HoldRule } from "@andornaut/game-kit/runtime/input/hold";
import type { HoldActionsBinding } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import type { PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";

import { assertGameActions, bindGameActions, type GameAction } from "../ui/index.ts";
import { type SceneInput, trackActionBinding } from "./modalInput.ts";

export interface ActionRoute<Control> {
  readonly controls: readonly Control[];
  element(control: Control): HTMLElement;
  controlAt(event: PointerEvent): Control | null;
  readonly accepts?: () => boolean;
  readonly available?: (control: Control) => boolean;
  readonly guard?: PressGuard;
  readonly identity?: (control: Control) => unknown;
  readonly ownAriaDisabled?: (control: Control) => GameAction["ownAriaDisabled"];
  readonly land?: (control: Control) => void;
  readonly preventPointerDefault?: (control: Control, event: PointerEvent) => boolean;
  readonly show?: (control: Control | undefined) => void;
  readonly rule?: (control: Control) => HoldRule | undefined;
  readonly hold?: (control: Control) => void;
  activate(control: Control): void;
}

export interface ActionTarget {
  readonly preventDefault: boolean;
  readonly target: HTMLElement | Document;
  readonly view: HTMLElement;
}

// The scene maps controls and feedback; the shared binding owns both tap and hold activation.
export function bindSceneActions<Control>(
  at: ActionTarget,
  input: SceneInput,
  route: ActionRoute<Control>,
): HoldActionsBinding {
  const controls = new Map(route.controls.map((control) => [route.element(control), control]));
  const action = (control: Control): GameAction => {
    const rule = route.rule?.(control);
    const ownAriaDisabled = route.ownAriaDisabled?.(control);
    return {
      activate: () => route.activate(control),
      available: () => route.accepts?.() !== false && route.available?.(control) !== false,
      element: route.element(control),
      ...(route.hold === undefined ? {} : { hold: () => route.hold!(control) }),
      identity: route.identity === undefined ? control : route.identity(control),
      ...(rule === undefined ? {} : { rule }),
      ...(ownAriaDisabled === undefined ? {} : { ownAriaDisabled }),
    };
  };
  const resolve = (target: EventTarget | null): GameAction | null => {
    let element = target instanceof Element ? target : null;
    while (element !== null && at.view.contains(element)) {
      if (controls.has(element as HTMLElement)) {
        return action(controls.get(element as HTMLElement)!);
      }
      element = element.parentElement;
    }
    return null;
  };
  // These existing root policies keep UI focus and implicit capture separate from canvas input.
  const down = (event: PointerEvent) => {
    const control = route.controlAt(event);
    if (control === null) {
      return;
    }
    if (at.preventDefault || route.preventPointerDefault?.(control, event)) {
      event.preventDefault();
    }
    if (event.target instanceof Element && event.target.hasPointerCapture(event.pointerId)) {
      event.target.releasePointerCapture(event.pointerId);
    }
  };
  at.target.addEventListener("pointerdown", down as EventListener, true);
  const binding = trackActionBinding(
    input,
    bindGameActions(
      {
        guard: route.guard ?? { gate: input },
        onPressChange: (pressed) => {
          const control = pressed === null ? undefined : controls.get(pressed.element);
          if (control !== undefined) {
            route.land?.(control);
          }
          route.show?.(control);
        },
        pointerTarget: at.target,
        resolve,
        resolvePointer: (event) => {
          const control = route.controlAt(event);
          return control === null ? null : action(control);
        },
      },
      at.view,
    ),
  );
  const dispose = () => {
    at.target.removeEventListener("pointerdown", down as EventListener, true);
    binding();
  };
  dispose.cancel = binding.cancel;
  try {
    assertGameActions(at.view);
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}

export type SceneButtonAction = Omit<GameAction, "available"> & {
  readonly available?: () => boolean;
  readonly preventTouchMouseDefault?: () => boolean;
  // The attribute that shows the button pressed: data-pressed, or the kit's data-ui-pressed for a
  // face on the kit's button frame states (buttonFrame.css).
  readonly pressedAttribute?: "data-pressed" | "data-ui-pressed";
};

export function bindSceneButtons(
  input: SceneInput,
  guard: PressGuard,
  actions: readonly SceneButtonAction[],
  root: HTMLElement,
): HoldActionsBinding {
  const elements = new Map(actions.map((action) => [action.element, action]));
  return bindSceneActions({ preventDefault: false, target: root, view: root }, input, {
    activate: (action) => action.activate(),
    available: (action) => action.available?.() !== false,
    controlAt: ({ target }) => {
      let element = target instanceof Element ? target : null;
      while (element !== null && root.contains(element)) {
        if (elements.has(element as HTMLElement)) {
          return elements.get(element as HTMLElement)!;
        }
        element = element.parentElement;
      }
      return null;
    },
    controls: actions,
    element: (action) => action.element,
    guard,
    hold: (action) => (action.hold ?? action.activate)(),
    identity: (action) => (action.identity === undefined ? action.element : action.identity),
    ownAriaDisabled: (action) => action.ownAriaDisabled,
    preventPointerDefault: (action, event) =>
      action.preventTouchMouseDefault !== undefined &&
      event.pointerType === "touch" &&
      event.isPrimary &&
      event.button === 0 &&
      !root.ownerDocument.hidden &&
      action.element.isConnected &&
      action.element.closest(":disabled, [hidden], [inert], [aria-disabled='true' i]") === null &&
      action.preventTouchMouseDefault(),
    rule: (action) => action.rule,
    show: (pressed) => {
      for (const action of actions) {
        action.element.toggleAttribute(
          action.pressedAttribute ?? "data-pressed",
          action === pressed && action.element.getAttribute("aria-disabled") !== "true",
        );
      }
    },
  });
}
