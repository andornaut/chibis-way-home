export const MOUSE_KEYS = { left: "MouseLeft", right: "MouseRight" } as const;

export function isMouseMovementKey(code: string): boolean {
  return code === MOUSE_KEYS.left || code === MOUSE_KEYS.right;
}

// Mouse buttons join held controls only on an eligible down. Movement never revives cleared input.
export function listenMouseMovement(
  accepts: (event: MouseEvent) => boolean,
  eventTarget: EventTarget,
  held: Set<string>,
): () => void {
  const keyFor = (button: number) =>
    button === 0 ? MOUSE_KEYS.left : button === 2 ? MOUSE_KEYS.right : undefined;
  const fromTouch = (event: MouseEvent) =>
    (
      event as MouseEvent & {
        readonly sourceCapabilities?: { readonly firesTouchEvents: boolean } | null;
      }
    ).sourceCapabilities?.firesTouchEvents === true;
  const clear = () => {
    held.delete(MOUSE_KEYS.left);
    held.delete(MOUSE_KEYS.right);
  };
  const down = (event: MouseEvent) => {
    const key = keyFor(event.button);
    if (key && !fromTouch(event) && accepts(event)) {
      held.add(key);
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
      held.delete(MOUSE_KEYS.left);
    }
    if (!(event.buttons & 2)) {
      held.delete(MOUSE_KEYS.right);
    }
  };
  const listeners = {
    blur: clear,
    mousedown: down,
    mousemove: move,
    mouseup: up,
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
