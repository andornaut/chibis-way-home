import {
  createModalInputGate,
  type ModalInputGate,
  type ModalInputScope,
} from "@andornaut/game-kit/runtime/input/modalInput";
import type { HoldActionsBinding } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import type { Input, Scene } from "phaser";

const gates = new WeakMap<object, ModalInputGate>();
const owners = new WeakMap<object, object>();
const inputs = new WeakMap<object, SceneInput>();
const readiness = new WeakMap<object, () => boolean>();
const menuRevisions = new WeakMap<object, number>();
const actionBindings = new WeakMap<SceneInput, Set<HoldActionsBinding>>();
const menuReadyCancels = new WeakMap<object, Set<() => void>>();

export function trackMenuActionBinding(
  scene: Scene,
  binding: HoldActionsBinding,
): HoldActionsBinding {
  let callbacks = menuReadyCancels.get(scene.game);
  if (callbacks === undefined) {
    callbacks = new Set();
    menuReadyCancels.set(scene.game, callbacks);
  }
  callbacks.add(binding.cancel);
  const registered = callbacks;
  const dispose = () => {
    registered.delete(binding.cancel);
    binding();
  };
  dispose.cancel = binding.cancel;
  return dispose;
}

export function trackActionBinding(
  input: SceneInput,
  binding: HoldActionsBinding,
): HoldActionsBinding {
  let bindings = actionBindings.get(input);
  if (bindings === undefined) {
    bindings = new Set();
    actionBindings.set(input, bindings);
    const registered = bindings;
    input.subscribe(() => registered.forEach((current) => current.cancel()));
  }
  bindings.add(binding);
  const registered = bindings;
  const dispose = () => {
    registered.delete(binding);
    binding();
  };
  dispose.cancel = binding.cancel;
  return dispose;
}

export interface SceneInput {
  accepts(event?: object): boolean;
  capture(): () => boolean;
  close(): void;
  invalidate(): void;
  open(): void;
  ready(value: boolean): void;
  subscribe(clear: () => void): void;
}

// The shared gate covers Phaser, forwarded keyboard, window and native-page input routes.
export function modalInput(scene: Scene): SceneInput {
  const found = inputs.get(scene);
  if (found) {
    return found;
  }
  let gate = gates.get(scene.game);
  if (!gate) {
    gate = createModalInputGate();
    gates.set(scene.game, gate);
    const gameGate = gate;
    const host = scene.game.canvas?.parentElement;
    const unsubscribe = gameGate.subscribe(() =>
      host?.toggleAttribute("data-modal-open", !gameGate.accepts()),
    );
    scene.game.events?.once("destroy", () => {
      unsubscribe();
      host?.removeAttribute("data-modal-open");
    });
  }
  const gameGate = gate;
  let scope: ModalInputScope | undefined;
  let ready = true;
  const unsubscribers: (() => void)[] = [];
  const accepts = () => ready && (scope ? scope.accepts() : gameGate.accepts());
  const input: SceneInput = {
    accepts(event) {
      if (!accepts() || (event && owners.has(event) && owners.get(event) !== scene)) {
        return false;
      }
      if (event && scope) {
        owners.set(event, scene);
      }
      return true;
    },
    capture() {
      const valid = scope ? scope.capture() : gameGate.capture();
      return () => accepts() && valid();
    },
    close() {
      scope?.close();
      scope = undefined;
    },
    invalidate() {
      input.close();
      input.open();
    },
    open() {
      scope ??= gameGate.open();
    },
    ready(value) {
      const changed = ready !== value;
      if (changed) {
        menuRevisions.set(scene.game, (menuRevisions.get(scene.game) ?? 0) + 1);
      }
      ready = value;
      if (changed) {
        actionBindings.get(input)?.forEach((binding) => binding.cancel());
        menuReadyCancels.get(scene.game)?.forEach((cancel) => cancel());
      }
    },
    subscribe(clear) {
      unsubscribers.push(gameGate.subscribe(clear));
    },
  };
  inputs.set(scene, input);
  readiness.set(scene, () => ready);
  scene.events.once("shutdown", () => {
    actionBindings.get(input)?.forEach((binding) => binding());
    actionBindings.delete(input);
    unsubscribers.forEach((stop) => stop());
    input.close();
    inputs.delete(scene);
    readiness.delete(scene);
  });
  return input;
}

type PointerEvent = "pointerdown" | "pointermove" | "pointerup" | "pointerupoutside";

// A release can complete only a fresh press from the same unchanged modal stack.
export function onScenePointer(
  scene: Scene,
  event: PointerEvent,
  listener: (pointer: Input.Pointer) => void,
): void {
  const input = modalInput(scene);
  onGatedPointer(scene, () => input, event, listener);
}

// onScenePointer, gated by the modal input gate names at each event: the scene's own, or another
// scene's whose scope the press answers to.
export function onGatedPointer(
  scene: Scene,
  gate: () => SceneInput,
  event: PointerEvent,
  listener: (pointer: Input.Pointer) => void,
): void {
  const presses = pointerPresses(scene);
  scene.input.on(event, (pointer: Input.Pointer) => {
    const input = gate();
    if (!input.accepts()) {
      return;
    }
    if (event === "pointerdown") {
      presses.set(pointer.id, input.capture());
    } else if (!presses.get(pointer.id)?.()) {
      return;
    }
    listener(pointer);
    if (event === "pointerup" || event === "pointerupoutside") {
      const press = presses.get(pointer.id);
      queueMicrotask(() => {
        if (presses.get(pointer.id) === press) {
          presses.delete(pointer.id);
        }
      });
    }
  });
}

const pointers = new WeakMap<object, Map<number, () => boolean>>();
function pointerPresses(scene: Scene): Map<number, () => boolean> {
  let found = pointers.get(scene);
  if (!found) {
    found = new Map();
    pointers.set(scene, found);
    const presses = found;
    modalInput(scene).subscribe(() => presses.clear());
    scene.events.once("shutdown", () => pointers.delete(scene));
  }
  return found;
}

// The persistent menu entry shares the modal and source-readiness invalidation boundary.
export function globalMenuInput(
  scene: Scene,
  enabled: () => boolean,
): Pick<SceneInput, "accepts" | "capture"> {
  modalInput(scene);
  const gate = gates.get(scene.game)!;
  let revision = 0;
  const stop = gate.subscribe(() => {
    revision++;
  });
  scene.events.once("shutdown", stop);
  return {
    accepts(event) {
      if (!enabled()) {
        return false;
      }
      if (event) {
        owners.set(event, scene);
      }
      return true;
    },
    capture() {
      const captured = revision;
      const sourceRevision = menuRevisions.get(scene.game);
      return () =>
        enabled() &&
        captured === revision &&
        sourceRevision === menuRevisions.get(scene.game);
    },
  };
}

export function menuSourceReady(scene: object): boolean {
  return readiness.get(scene)?.() ?? true;
}
