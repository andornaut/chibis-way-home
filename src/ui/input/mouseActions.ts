export const MOUSE_KEYS = { jump: "MouseLeft", use: "MouseRight" } as const;

// A mouse button holds its action from an accepted down until release, even if it leaves play.
export function listenMouseActions(
  accepts: (event: MouseEvent) => boolean,
  eventTarget: EventTarget,
  held: Set<string>,
  pressed: Set<string>,
): () => void {
  let contextTarget: EventTarget | null = null;
  const keyFor = (button: number) =>
    button === 0 ? MOUSE_KEYS.jump : button === 2 ? MOUSE_KEYS.use : undefined;
  const fromTouch = (event: MouseEvent) =>
    (
      event as MouseEvent & {
        readonly sourceCapabilities?: { readonly firesTouchEvents: boolean } | null;
      }
    ).sourceCapabilities?.firesTouchEvents === true;
  const clear = () => {
    held.delete(MOUSE_KEYS.jump);
    held.delete(MOUSE_KEYS.use);
    pressed.clear();
    contextTarget = null;
  };
  const down = (event: MouseEvent) => {
    if (fromTouch(event)) {
      return;
    }
    if (event.button === 2) {
      contextTarget = null;
    }
    const key = keyFor(event.button);
    if (key && !event.defaultPrevented && accepts(event)) {
      held.add(key);
      pressed.add(key);
      if (key === MOUSE_KEYS.use) {
        contextTarget = event.target;
      }
    }
  };
  const up = (event: MouseEvent) => {
    const key = keyFor(event.button);
    if (key && !fromTouch(event)) {
      held.delete(key);
    }
  };
  const move = (event: MouseEvent) => {
    if (fromTouch(event)) {
      return;
    }
    if (!(event.buttons & 1)) {
      held.delete(MOUSE_KEYS.jump);
    }
    if (!(event.buttons & 2)) {
      held.delete(MOUSE_KEYS.use);
      contextTarget = null;
    }
  };
  // Native contextmenu may come before or after mouseup. Claim only the consumed right press
  // on its original surface, even if its action has opened a modal in the meantime.
  const menu = (event: MouseEvent) => {
    if (
      event.button !== 2 ||
      fromTouch(event) ||
      ("pointerType" in event && event.pointerType !== "mouse")
    ) {
      return;
    }
    if (contextTarget !== null && event.target === contextTarget) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    contextTarget = null;
  };
  const cancel = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      clear();
    }
  };
  const listeners = {
    blur: clear,
    contextmenu: menu,
    mousedown: down,
    mousemove: move,
    mouseup: up,
    pagehide: clear,
    pointercancel: cancel,
  };
  const options = { capture: true };
  for (const [type, listener] of Object.entries(listeners)) {
    eventTarget.addEventListener(type, listener as EventListener, options);
  }
  return () => {
    for (const [type, listener] of Object.entries(listeners)) {
      eventTarget.removeEventListener(type, listener as EventListener, options);
    }
    clear();
  };
}
