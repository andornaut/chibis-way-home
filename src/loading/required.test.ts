// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

import { CARD_CONTENT, TEXT_BUTTON } from "../data/layout.ts";
import { mountRequiredLoading, requiredLoading } from "./required.ts";

let stopView = () => {};
const resources: (() => void)[] = [];
afterEach(() => {
  stopView();
  resources.splice(0).forEach((stop) => stop());
  requiredLoading.dispose();
  document.getElementById("game")?.remove();
  vi.restoreAllMocks();
});

it("refits only the native presentation while preserving resource ownership and pending Retry", async () => {
  const game = document.createElement("div");
  game.id = "game";
  const layer = document.createElement("div");
  layer.className = "ui-layer";
  layer.style.setProperty("--ui-unit", "1.5");
  const host = document.createElement("div");
  game.append(layer, host);
  document.body.append(game);
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const successfulRetry = vi.fn();
  resources.push(requiredLoading.observe({ retry: successfulRetry, status: () => "ready" }));
  stopView = mountRequiredLoading(host);
  expect(host.querySelector(".loading-failure")).toBeNull();
  let failed = true;
  let finish!: () => void;
  const retry = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  resources.push(requiredLoading.observe({ retry, status: () => (failed ? "failed" : "ready") }));
  const first = host.querySelector<HTMLElement>(".loading-failure")!;
  const firstButton = first.querySelector<HTMLButtonElement>("button")!;
  expect(firstButton.style.minHeight).toBe(`${TEXT_BUTTON.height * 1.5}px`);
  expect(firstButton.style.alignSelf).toBe("flex-end");
  expect(first.style.gap).toBe(`${CARD_CONTENT.gap * 1.5}px`);
  expect(first.style.padding).toBe(`${CARD_CONTENT.padding * 1.5}px`);
  const state = requiredLoading.state;
  window.dispatchEvent(new Event("resize"));
  expect(host.querySelector(".loading-failure")).toBe(first);
  firstButton.focus();
  layer.style.setProperty("--ui-unit", "2");
  window.dispatchEvent(new Event("resize"));
  const second = host.querySelector<HTMLElement>(".loading-failure")!;
  const secondButton = second.querySelector<HTMLButtonElement>("button")!;
  expect(second).not.toBe(first);
  expect(first.isConnected).toBe(false);
  expect(secondButton.style.minHeight).toBe(`${TEXT_BUTTON.height * 2}px`);
  expect(document.activeElement).toBe(secondButton);
  expect(requiredLoading.state).toBe(state);
  expect(retry).not.toHaveBeenCalled();
  expect(successfulRetry).not.toHaveBeenCalled();
  layer.style.setProperty("--ui-unit", "3");
  secondButton.click();
  expect(host.querySelector(".loading-failure")).toBe(second);
  expect(secondButton.disabled).toBe(true);
  const flight = requiredLoading.retry();
  expect(requiredLoading.retry()).toBe(flight);
  expect(retry).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event("resize"));
  expect(host.querySelector(".loading-failure")).toBe(second);
  expect(secondButton.disabled).toBe(true);
  const resizeListeners = add.mock.calls.filter(([type]) => type === "resize");
  expect(resizeListeners).toHaveLength(1);
  stopView();
  expect(remove).toHaveBeenCalledWith("resize", resizeListeners[0]![1]);
  expect(requiredLoading.state.kind).toBe("failed");
  expect(host.querySelector(".loading-failure")).toBeNull();
  failed = false;
  finish();
  await flight;
  await Promise.resolve();
  window.dispatchEvent(new Event("resize"));
  expect(host.querySelector(".loading-failure")).toBeNull();
  expect(requiredLoading.state.kind).toBe("ready");
  expect(retry).toHaveBeenCalledOnce();
  expect(successfulRetry).not.toHaveBeenCalled();
});
