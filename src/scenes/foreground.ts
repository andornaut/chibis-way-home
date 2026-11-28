import { foregroundKeyAction } from "@andornaut/game-kit/runtime/ui/focusKeys";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import type { Scene } from "phaser";

import {
  foregroundAction,
  foregroundInput,
  foregroundSkip,
  foregroundTargets,
} from "../ui/binding/index.ts";
import { globalMenuInput, menuSourceReady, modalInput } from "./modalInput.ts";

const PAGE_DEFAULTS = new Set(["start", "map", "opening", "celebration"]);
const MAP_DIRECTIONS = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "KeyH", "KeyL"]);

export function registerSceneForeground(scene: Scene, root: HTMLElement): () => void {
  const key = scene.sys.settings.key;
  if (["zone", "zoneBark", "achievementNotice"].includes(key)) {
    return () => {};
  }
  const input = modalInput(scene);
  const ready = () => menuSourceReady(scene) && input.accepts();
  const surfaceRoot = root.closest<HTMLElement>(".ui-layer") ?? root;
  const menu = () => surfaceRoot.querySelector<HTMLElement>(".pause-button");
  const stop = foregroundInput(root.ownerDocument).register({
    active: () => scene.scene.isActive() && root.isConnected && !root.hidden,
    dismiss: () => {
      if (key === "start") {
        return null;
      }
      const close = root.querySelector<HTMLElement>(
        key === "room"
          ? '[data-control="leave"]'
          : key === "map"
            ? '[data-control="home"]'
            : '[data-control="exit"]',
      );
      return close === null ? null : foregroundAction(close);
    },
    ...(key === "start" ? { escape: "pass-through" as const } : {}),
    guard: { gate: input },
    preserveKey: (event) =>
      key === "map" &&
      mapDirectionalKey(event) &&
      ready() &&
      scene.input.enabled &&
      root.closest("[inert]") === null,
    ready,
    resolve: (target) =>
      target instanceof Node && (root.contains(target) || menu()?.contains(target))
        ? foregroundAction(target)
        : null,
    root: surfaceRoot,
    skip: () => foregroundSkip(root),
    tabTargets: () => {
      const entry = menu();
      return [
        ...foregroundTargets(root),
        ...(entry !== null && foregroundAction(entry) !== null ? [entry] : []),
      ];
    },
    targets: () => foregroundTargets(root),
  });
  const focusDefault = () => {
    if (
      !PAGE_DEFAULTS.has(key) ||
      !scene.scene.isActive() ||
      !root.isConnected ||
      !ready() ||
      root.closest("[hidden],[inert],[data-ui-unready]") !== null
    ) {
      return;
    }
    const active = root.ownerDocument.activeElement;
    if (active === root.ownerDocument.body || active === root.ownerDocument.documentElement) {
      const first = foregroundTargets(root).find(
        (target) =>
          foregroundAction(target) !== null &&
          !target.hidden &&
          target.closest("[hidden],[inert]") === null,
      );
      if (first !== undefined) {
        focusTarget(first);
      }
    }
  };
  scene.events.on("postupdate", focusDefault);
  return () => {
    scene.events.off("postupdate", focusDefault);
    stop();
  };
}

// The world owns bare keys; an actual focused HUD control owns discrete UI aliases.
export function preserveGameplayKey(root: HTMLElement, event: KeyboardEvent): boolean {
  const document = root.ownerDocument;
  const host = document.getElementById("game");
  return (
    event.key !== "Escape" &&
    [document.body, document.documentElement, host, host?.querySelector("canvas")].includes(
      event.target as HTMLElement,
    )
  );
}

export function registerGameplayForeground(scene: Scene, root: HTMLElement): () => void {
  return foregroundInput(root.ownerDocument).register({
    active: () => scene.scene.isActive("zone") && root.isConnected,
    escape: "pass-through",
    guard: {
      gate: globalMenuInput(
        scene,
        () => scene.scene.isActive("zone") && menuSourceReady(scene.scene.get("zone")),
      ),
    },
    preserveKey: (event) => preserveGameplayKey(root, event),
    ready: () => menuSourceReady(scene.scene.get("zone")),
    resolve: foregroundAction,
    root,
    targets: () => foregroundTargets(root),
  });
}

export function mapDirectionalKey(event: KeyboardEvent): boolean {
  return (
    !event.defaultPrevented &&
    MAP_DIRECTIONS.has(event.code) &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !(
      event.target instanceof Element &&
      event.target.closest(
        "input,textarea,select,[contenteditable],[role=textbox],dialog[open],[role=slider]",
      )
    )
  );
}

export function defaultForeground(
  input: ReturnType<typeof modalInput>,
  close: () => void,
  root: HTMLElement,
) {
  return {
    guard: { gate: input },
    resolve: (target: EventTarget) =>
      target === root
        ? { activate: close, available: () => input.accepts(), element: root, identity: root }
        : foregroundAction(target),
  };
}

export function stageNavigationKey(event: KeyboardEvent): boolean {
  const action = foregroundKeyAction(event.key, event.shiftKey);
  return (
    !event.defaultPrevented &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    (!event.shiftKey || event.key === "Tab") &&
    !(
      event.target instanceof Element &&
      event.target.closest(
        "input,textarea,select,[contenteditable],[role=textbox],dialog[open],[role=slider]",
      )
    ) &&
    (action === "next" || action === "previous")
  );
}
