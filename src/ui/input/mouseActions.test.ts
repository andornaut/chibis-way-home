import { expect, it, vi } from "vitest";

import { keyIntent } from "./intent.ts";
import { listenMouseActions, MOUSE_KEYS } from "./mouseActions.ts";

function fixture() {
  const target = new EventTarget();
  const held = new Set<string>();
  const accepts = vi.fn(() => true);
  const stop = listenMouseActions(accepts, target, held, new Set());
  const send = (type: string, button = 0, buttons = 0, touch = false) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      button: { value: button },
      buttons: { value: buttons },
      pointerType: { value: touch ? "touch" : "mouse" },
      sourceCapabilities: { value: { firesTouchEvents: touch } },
    });
    target.dispatchEvent(event);
    return event;
  };
  return { accepts, held, send, stop };
}

it("holds jump and use independently through each button's release", () => {
  const f = fixture();
  f.send("mousedown", 0, 1);
  expect(keyIntent(f.held)).toEqual({ jump: true, move: 0, use: false });
  f.send("mousedown", 2, 3);
  expect(keyIntent(f.held)).toEqual({ jump: true, move: 0, use: true });
  f.send("mouseup", 0, 2);
  expect(keyIntent(f.held)).toEqual({ jump: false, move: 0, use: true });
  f.send("mouseup", 2, 0);
  expect(f.held.size).toBe(0);
  f.stop();
});

it("keeps refused UI downs unclaimed when dragged onto play", () => {
  const f = fixture();
  f.accepts.mockReturnValue(false);
  f.send("mousedown", 0, 1);
  f.accepts.mockReturnValue(true);
  f.send("mousemove", 0, 1);
  expect(f.held.size).toBe(0);
  f.send("mousedown", 2, 3);
  expect([...f.held]).toEqual([MOUSE_KEYS.use]);
  f.send("mouseup", 0, 2);
  expect(keyIntent(f.held).use).toBe(true);
  f.stop();
});

it("does not revive a held physical button after modal or scene controls clear", () => {
  const f = fixture();
  f.send("mousedown", 0, 1);
  f.held.clear();
  f.send("mousemove", 0, 1);
  expect(f.held.size).toBe(0);
  f.send("mouseup", 0, 0);
  f.send("mousedown", 0, 1);
  expect(keyIntent(f.held).jump).toBe(true);
  f.stop();
});

it("clears lost releases and blur without changing keyboard controls", () => {
  const f = fixture();
  f.held.add("KeyD");
  f.send("mousedown", 0, 1);
  expect(keyIntent(f.held)).toEqual({ jump: true, move: 1, use: false });
  f.send("mousemove", 0, 0);
  expect([...f.held]).toEqual(["KeyD"]);
  f.send("mousedown", 2, 2);
  f.send("blur");
  expect([...f.held]).toEqual(["KeyD"]);
  f.stop();
});

it("ignores middle clicks and touch compatibility events, then removes all listeners", () => {
  const f = fixture();
  f.send("mousedown", 1, 4);
  f.send("mousedown", 0, 1, true);
  expect(f.held.size).toBe(0);
  f.send("mousedown", 2, 2);
  f.send("mousemove", 0, 0, true);
  f.send("mouseup", 2, 0, true);
  expect([...f.held]).toEqual([MOUSE_KEYS.use]);
  f.stop();
  expect(f.held.size).toBe(0);
  f.send("mousedown", 0, 1);
  expect(f.held.size).toBe(0);
});

it("suppresses only the native context menu of an accepted right press", () => {
  const f = fixture();
  expect(f.send("contextmenu", 2).defaultPrevented).toBe(false);
  f.accepts.mockReturnValue(false);
  f.send("mousedown", 2, 2);
  expect(f.send("contextmenu", 2).defaultPrevented).toBe(false);
  f.accepts.mockReturnValue(true);
  f.send("mousedown", 2, 2);
  f.send("mouseup", 2);
  expect(f.send("contextmenu", 0).defaultPrevented).toBe(false);
  expect(f.send("contextmenu", 2, 0, true).defaultPrevented).toBe(false);
  expect(f.send("contextmenu", 2).defaultPrevented).toBe(true);
  expect(f.send("contextmenu", 2).defaultPrevented).toBe(false);
  f.send("mousedown", 2, 2);
  f.send("pointercancel", 0, 0, true);
  expect(keyIntent(f.held).use).toBe(true);
  f.send("pointercancel");
  expect(keyIntent(f.held).use).toBe(false);
  expect(f.send("contextmenu", 2).defaultPrevented).toBe(false);
  f.stop();
});
