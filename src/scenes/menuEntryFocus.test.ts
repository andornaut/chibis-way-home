// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { menuEntryFocus } from "./menuEntryFocus.ts";

it("joins the ends of a full-page focus order without changing its internal steps or following held Tab", () => {
  const root = document.createElement("section"),
    entry = document.createElement("button");
  const first = document.createElement("button"),
    last = document.createElement("button");
  root.append(first, last);
  document.body.append(root, entry);
  const step = (shiftKey = false, repeat = false) => {
    const event = new KeyboardEvent("keydown", { cancelable: true, key: "Tab", repeat, shiftKey });
    menuEntryFocus(document, entry, root, event);
    return event;
  };
  first.focus();
  expect(step().defaultPrevented).toBe(false);
  last.focus();
  expect(step().defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(entry);
  expect(step(false, true).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(entry);
  step();
  expect(document.activeElement).toBe(first);
  step(true);
  expect(document.activeElement).toBe(entry);
  step(true);
  expect(document.activeElement).toBe(last);
  root.remove();
  entry.remove();
});

it("completes an arrow-only page and Menu cycle without taking horizontal or editor keys", () => {
  const root = document.createElement("section");
  const entry = document.createElement("button");
  const first = document.createElement("button");
  const last = document.createElement("button");
  const editor = document.createElement("input");
  root.append(first, last, editor);
  document.body.append(root, entry);
  const step = (key: string) => {
    const event = new KeyboardEvent("keydown", { cancelable: true, key });
    menuEntryFocus(document, entry, root, event);
    return event;
  };
  last.focus();
  expect(step("ArrowDown").defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(entry);
  step("ArrowDown");
  expect(document.activeElement).toBe(first);
  step("ArrowUp");
  expect(document.activeElement).toBe(entry);
  step("ArrowUp");
  expect(document.activeElement).toBe(last);
  expect(step("ArrowLeft").defaultPrevented).toBe(false);
  expect(step("ArrowRight").defaultPrevented).toBe(false);
  editor.focus();
  expect(step("ArrowDown").defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(editor);
  root.remove();
  entry.remove();
});
