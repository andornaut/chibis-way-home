import type { HoldRule } from "@andornaut/game-kit/runtime/input/hold";
import {
  bindHoldActions,
  type HoldAction,
  type HoldActionBinding,
  type HoldActionsBinding,
} from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import { guardClicks, type PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";
import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { TOUCH } from "../../data/touch.ts";

export type GameAction = Omit<HoldAction, "rule"> & { readonly rule?: HoldRule };

export interface GameActionOptions {
  readonly guard: PressGuard;
  readonly resolve: (target: EventTarget | null) => GameAction | null;
  readonly pointerTarget?: HTMLElement | Document;
  readonly resolvePointer?: (event: PointerEvent) => GameAction | null;
  readonly onPressChange?: (action: HoldAction | null) => void;
}

const registrations = new WeakMap<HTMLElement, Set<{ resolve: GameActionOptions["resolve"] }>>();
const DISCRETE_CONTROLS = [
  "button",
  'input:is([type="button"],[type="submit"],[type="reset"],[type="checkbox"],[type="radio"])',
  '[role="button"],[role="checkbox"],[role="radio"],[role="switch"]',
].join(",");

function registered(
  resolve: GameActionOptions["resolve"],
  root: HTMLElement,
  binding: HoldActionsBinding,
): HoldActionsBinding {
  let entries = registrations.get(root);
  if (entries === undefined) {
    entries = new Set();
    registrations.set(root, entries);
  }
  const entry = { resolve };
  entries.add(entry);
  const owned = entries;
  const dispose = () => {
    owned.delete(entry);
    binding();
  };
  dispose.cancel = binding.cancel;
  return dispose;
}

// Registration is structural: disabled, hidden and not-yet-ready controls still have actions.
// Text editors, native selects and continuous range/drag controls retain their native ownership.
export function assertGameActions(root: HTMLElement): void {
  const controls = [...root.querySelectorAll<HTMLElement>(DISCRETE_CONTROLS)];
  if (root.matches(DISCRETE_CONTROLS)) {
    controls.push(root);
  }
  for (const control of controls) {
    let element: HTMLElement | null = control;
    let found = false;
    while (element !== null && root.contains(element)) {
      for (const entry of registrations.get(element) ?? []) {
        const action = entry.resolve(control);
        const label =
          action?.element.matches("label") &&
          control.matches('input:is([type="checkbox"],[type="radio"])') &&
          action.element.contains(control);
        if (
          action !== null &&
          (action.element === control || label) &&
          element.contains(action.element)
        ) {
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
      element = element.parentElement;
    }
    if (!found) {
      throw new Error("Every discrete control must register its action");
    }
  }
}

function resolved(action: GameAction | null): HoldAction | null {
  return action === null
    ? null
    : {
        ...action,
        rule: action.rule ?? {
          holdMs: TOUCH.actionHoldMilliseconds,
          slopPx: TOUCH.tapMaxDistance * readUnit(action.element),
        },
      };
}

// Pointer taps and holds share the kit's lifecycle; native keyboard activation keeps its guard.
export function bindGameActions(options: GameActionOptions, root: HTMLElement): HoldActionsBinding {
  const binding = bindHoldActions(
    {
      activation: "pointer-release",
      guard: options.guard,
      onPressChange: options.onPressChange,
      pointerTarget: options.pointerTarget,
      resolve: (target) => resolved(options.resolve(target)),
      resolvePointer: (event) =>
        resolved(
          options.resolvePointer === undefined
            ? options.resolve(event.target)
            : options.resolvePointer(event),
        ),
    },
    root,
  );
  const stopGuard = guardClicks(options.guard, root);
  const click = (event: MouseEvent) => {
    if (event.detail !== 0 || !options.guard.gate.accepts()) {
      return;
    }
    const action = options.resolve(event.target);
    if (action?.available()) {
      action.activate();
    }
  };
  root.addEventListener("click", click);
  const dispose = () => {
    binding();
    stopGuard();
    root.removeEventListener("click", click);
  };
  dispose.cancel = binding.cancel;
  return registered(options.resolve, root, dispose);
}

// Factories retain their native click ownership and original guarded semantic callback.
// readUnit supplies CSS unit 1 for cold controls outside the game's fitted UI layer.
export function bindNativeGameActions(
  guard: PressGuard,
  resolve: (target: EventTarget | null) => GameAction | null,
  root: HTMLElement,
): HoldActionsBinding {
  return registered(
    resolve,
    root,
    bindHoldActions({ guard, resolve: (target) => resolved(resolve(target)) }, root),
  );
}

export const bindFactoryAction: HoldActionBinding = (action) => {
  const gate = {
    accepts: action.available,
    capture: () => {
      const accepted = action.available();
      return () => accepted && action.available();
    },
  };
  return bindNativeGameActions(
    { gate },
    (target) => (target instanceof Node && action.element.contains(target) ? action : null),
    action.element,
  );
};
