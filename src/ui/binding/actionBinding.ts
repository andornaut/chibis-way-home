import type { HoldRule } from "@andornaut/game-kit/runtime/input/hold";
import type { ForegroundAction } from "@andornaut/game-kit/runtime/web/input/dom/foregroundInput";
import {
  bindHoldActions,
  type HoldAction,
  type HoldActionBinding,
  type HoldActionsBinding,
} from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import {
  type ButtonAppearance,
  type ButtonContent,
  type ButtonOptions,
  type ButtonState,
  type ButtonView,
  createButton,
} from "@andornaut/game-kit/runtime/web/ui/dom/button";
import { guardClicks, type PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";
import {
  createFormRow,
  type FormRowOptions,
  type FormRowView,
} from "@andornaut/game-kit/runtime/web/ui/dom/formRow";
import {
  createHudDisc,
  type HudDiscOptions,
  type HudDiscView,
} from "@andornaut/game-kit/runtime/web/ui/dom/hudDisc";
import {
  createPager,
  type PagerOptions,
  type PagerView,
} from "@andornaut/game-kit/runtime/web/ui/dom/pager";
import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { TOUCH } from "../../data/touch.ts";

export type GameAction = Omit<HoldAction, "rule"> & { readonly rule?: HoldRule };

export interface GameActionOptions {
  readonly guard: PressGuard;
  readonly resolve: (target: EventTarget | null) => GameAction | null;
  readonly pointerTarget?: HTMLElement | Document;
  readonly resolvePointer?: (event: PointerEvent) => GameAction | null;
  readonly targets?: (() => readonly HTMLElement[]) | undefined;
  readonly onPressChange?: (action: HoldAction | null) => void;
}

interface ActionRegistration {
  readonly resolve: GameActionOptions["resolve"];
  readonly targets?: (() => readonly HTMLElement[]) | undefined;
  readonly guard?: PressGuard | undefined;
}

const registrations = new WeakMap<HTMLElement, Set<ActionRegistration>>();
// A standard control's part in the binding: a button's, or a form row's.
type StandardControl = Pick<ButtonView, "dispose" | "holdAction" | "setPressed">;

const standardButtons = new WeakMap<HTMLElement, StandardControl>();
const DISCRETE_CONTROLS = [
  "button",
  'input:is([type="button"],[type="submit"],[type="reset"],[type="checkbox"],[type="radio"])',
  '[role="button"],[role="checkbox"],[role="radio"],[role="switch"]',
].join(",");

function registered(
  resolve: GameActionOptions["resolve"],
  root: HTMLElement,
  binding: HoldActionsBinding,
  guard?: PressGuard,
  targets?: () => readonly HTMLElement[],
): HoldActionsBinding {
  let entries = registrations.get(root);
  if (entries === undefined) {
    entries = new Set();
    registrations.set(root, entries);
  }
  const entry = { guard, resolve, targets };
  entries.add(entry);
  const owned = entries;
  const dispose = () => {
    owned.delete(entry);
    binding();
  };
  dispose.cancel = binding.cancel;
  return dispose;
}

function currentButtonAction(button: HTMLElement): GameAction | null {
  for (
    let element: HTMLElement | null = button;
    element !== null;
    element = element.parentElement
  ) {
    for (const entry of registrations.get(element) ?? []) {
      const action = entry.resolve(button);
      if (
        action?.element === button &&
        entry.guard?.gate.accepts() !== false &&
        action.available()
      ) {
        return action;
      }
    }
  }
  return null;
}

// The hold rule of the standard control that mounted holds once it is created.
function gameHoldRule(mounted: { readonly element?: HTMLElement }): HoldRule {
  return {
    holdMs: TOUCH.actionHoldMilliseconds,
    get slopPx() {
      const { element } = mounted;
      return TOUCH.tapMaxDistance * (element === undefined ? 1 : readUnit(element));
    },
  };
}

// A standard button's state, read from its element.
function gameButtonState(element: HTMLButtonElement): ButtonState {
  const pressed = element.getAttribute("aria-pressed");
  return {
    availability: {
      kind: element.hidden ? "omitted" : element.disabled ? "disabled" : "available",
    },
    ...(pressed === "true" || pressed === "false" ? { toggled: pressed === "true" } : {}),
  };
}

export function createGameButton(
  document: Document,
  appearance: ButtonAppearance,
  content: ButtonContent,
  state?: Pick<ButtonOptions, "getState" | "onPointerRefusal">,
): ButtonView {
  const mounted: { element?: HTMLButtonElement } = {};
  const view = createButton(document, {
    appearance: { ...appearance, layout: "caller" },
    content,
    getAction: currentButtonAction,
    getState: gameButtonState,
    ...state,
    rule: gameHoldRule(mounted),
  });
  mounted.element = view.element;
  standardButtons.set(view.element, view);
  return view;
}

// A kit form row as a standard control: the whole row takes the action its scene binds to it.
export function createGameFormRow(
  document: Document,
  options: Omit<FormRowOptions, "getAction" | "rule">,
): FormRowView {
  const mounted: { element?: HTMLButtonElement } = {};
  const view = createFormRow(document, {
    ...options,
    getAction: currentButtonAction,
    rule: gameHoldRule(mounted),
  });
  mounted.element = view.element;
  standardButtons.set(view.element, view);
  return view;
}

export interface GamePager {
  // Previous and Next as the actions a scene binds, in that order.
  readonly actions: readonly [GameAction, GameAction];
  readonly view: PagerView;
}

// A pager on the kit's (pager.css): Previous, the page count and Next. Its buttons are standard
// buttons, so the shared binding presses and holds them as it does createGameButton's, and each
// runs the pager's own step under its guard, or its refusal.
export function createGamePager(
  document: Document,
  options: Omit<PagerOptions, "rule">,
): GamePager {
  const mounted: { element?: HTMLElement } = {};
  const view = createPager(document, { ...options, rule: gameHoldRule(mounted) });
  mounted.element = view.element;
  const action = (button: ButtonView): GameAction => {
    standardButtons.set(button.element, button);
    return {
      activate: () => button.holdAction()?.activate(),
      available: () => true,
      element: button.element,
      // The step's own identity, which the binding matches against the button's current action.
      get identity() {
        return button.holdAction()?.identity;
      },
    };
  };
  return { actions: [action(view.previous), action(view.next)], view };
}

// The kit's HUD disc, bound as createGameButton binds a button.
export function createGameHudDisc(
  document: Document,
  disc: Omit<HudDiscOptions, "getAction" | "getState" | "rule">,
): HudDiscView {
  const mounted: { element?: HTMLElement } = {};
  const view = createHudDisc(document, {
    ...disc,
    getAction: currentButtonAction,
    getState: gameButtonState,
    rule: gameHoldRule(mounted),
  });
  mounted.element = view.element;
  standardButtons.set(view.element, view);
  return view;
}

export function disposeGameButtons(root: HTMLElement): void {
  standardButtons.get(root)?.dispose();
  for (const button of root.querySelectorAll<HTMLElement>(".ui-standard-button")) {
    standardButtons.get(button)?.dispose();
  }
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
  if (action !== null) {
    const view = standardButtons.get(action.element);
    if (view !== undefined) {
      const descriptor = action.available() ? view.holdAction() : null;
      if (
        descriptor === null ||
        !Object.is(
          descriptor.identity,
          action.identity === undefined ? action.element : action.identity,
        )
      ) {
        return null;
      }
      return action.rule === undefined ? descriptor : { ...descriptor, rule: action.rule };
    }
  }
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
  let pressed: StandardControl | undefined;
  const binding = bindHoldActions(
    {
      activation: "pointer-release",
      allowNonPrimaryTouch: true,
      guard: options.guard,
      onPressChange: (action) => {
        pressed?.setPressed(false);
        pressed = action === null ? undefined : standardButtons.get(action.element);
        pressed?.setPressed(true);
        options.onPressChange?.(action);
      },
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
    if (action !== null && !standardButtons.has(action.element) && action.available()) {
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
  return registered(options.resolve, root, dispose, options.guard, options.targets);
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
    bindHoldActions(
      { allowNonPrimaryTouch: true, guard, resolve: (target) => resolved(resolve(target)) },
      root,
    ),
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

// Foreground keyboard and secondary clicks reuse the exact guarded semantic action.
export function foregroundAction(target: EventTarget): ForegroundAction | null {
  let node =
    target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;
  const control = node?.closest<HTMLElement>(
    'button,[role="button"],[role="switch"],[data-control]',
  );
  if (control !== null && control !== undefined) {
    const action = currentButtonAction(control);
    return action === null ? null : { ...action, identity: action.identity ?? action.element };
  }
  while (node !== null) {
    const action = currentButtonAction(node);
    if (action !== null) {
      return { ...action, identity: action.identity ?? action.element };
    }
    node = node.parentElement;
  }
  return null;
}

export function foregroundTargets(root: HTMLElement): readonly HTMLElement[] {
  for (let node: HTMLElement | null = root; node !== null; node = node.parentElement) {
    const targets = [...(registrations.get(node) ?? [])].flatMap(
      (entry) => entry.targets?.() ?? [],
    );
    if (targets.length > 0) {
      return [...new Set(targets)].filter(
        (target) => root.contains(target) && target.tabIndex >= 0,
      );
    }
  }
  return [...root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[tabindex]")];
}

export function foregroundSkip(root: HTMLElement): ForegroundAction | null {
  const skip = root.querySelector<HTMLElement>('[data-control="skip"]');
  return skip === null || skip.hidden ? null : foregroundAction(skip);
}

export function foregroundPolicy(root: HTMLElement) {
  let guard: PressGuard | undefined;
  for (
    let node: HTMLElement | null = root;
    node !== null && guard === undefined;
    node = node.parentElement
  ) {
    guard = [...(registrations.get(node) ?? [])].find((entry) => entry.guard !== undefined)?.guard;
  }
  return {
    ...(guard === undefined ? {} : { guard }),
    resolve: foregroundAction,
    skip: () => foregroundSkip(root),
    targets: () => foregroundTargets(root),
  };
}
