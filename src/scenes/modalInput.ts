import {
  createModalInputGate,
  type ModalInputGate,
  type ModalInputScope,
} from "@andornaut/game-kit/input/modalInput";
import type { Input, Scene } from "phaser";

const gates = new WeakMap<object, ModalInputGate>();
const owners = new WeakMap<object, object>();
const inputs = new WeakMap<object, SceneInput>();

interface SceneInput {
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
      ready = value;
    },
    subscribe(clear) {
      unsubscribers.push(gameGate.subscribe(clear));
    },
  };
  inputs.set(scene, input);
  scene.events.once("shutdown", () => {
    unsubscribers.forEach((stop) => stop());
    input.close();
    inputs.delete(scene);
  });
  return input;
}

// A release can complete only a fresh press from the same unchanged modal stack.
export function onScenePointer(
  scene: Scene,
  event: "pointerdown" | "pointermove" | "pointerup" | "pointerupoutside",
  listener: (pointer: Input.Pointer) => void,
): void {
  const input = modalInput(scene);
  const presses = pointerPresses(scene);
  scene.input.on(event, (pointer: Input.Pointer) => {
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
