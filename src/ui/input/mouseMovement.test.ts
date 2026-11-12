import { expect, it, vi } from "vitest";

import { keyIntent } from "./intent.ts";
import { listenMouseMovement, MOUSE_KEYS } from "./mouseMovement.ts";

function fixture() {
  const target = new EventTarget();
  const held = new Set<string>();
  const accepts = vi.fn(() => true);
  const stop = listenMouseMovement(accepts, target, held);
  const send = (type: string, button = 0, buttons = 0, touch = false) => {
    const event = new Event(type);
    Object.defineProperties(event, {
      button: { value: button },
      buttons: { value: buttons },
      sourceCapabilities: { value: { firesTouchEvents: touch } },
    });
    target.dispatchEvent(event);
  };
  return { accepts, held, send, stop };
}

it("tracks left and right chords independently through each button's release", () => {
  const f = fixture();
  f.send("mousedown", 0, 1);
  expect(keyIntent(f.held).move).toBe(-1);
  f.send("mousedown", 2, 3);
  expect(keyIntent(f.held).move).toBe(0);
  f.send("mouseup", 0, 2);
  expect(keyIntent(f.held).move).toBe(1);
  f.send("mouseup", 2, 0);
  expect(keyIntent(f.held).move).toBe(0);
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
  expect([...f.held]).toEqual([MOUSE_KEYS.right]);
  f.send("mouseup", 0, 2);
  expect(keyIntent(f.held).move).toBe(1);
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
  expect(keyIntent(f.held).move).toBe(-1);
  f.stop();
});

it("clears lost releases and blur without changing keyboard controls", () => {
  const f = fixture();
  f.held.add("KeyD");
  f.send("mousedown", 0, 1);
  expect(keyIntent(f.held).move).toBe(0);
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
  expect([...f.held]).toEqual([MOUSE_KEYS.right]);
  f.stop();
  expect(f.held.size).toBe(0);
  f.send("mousedown", 0, 1);
  expect(f.held.size).toBe(0);
});
