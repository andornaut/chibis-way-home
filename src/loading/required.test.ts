// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LOADING_FAILURE_PRESENTATION } from "../data/layout.ts";
let loading: typeof import("./required.ts");
let requiredLoading: typeof loading.requiredLoading;
let mountRequiredLoading: typeof loading.mountRequiredLoading;
beforeEach(async () => {
  vi.resetModules();
  loading = await import("./required.ts");
  ({ mountRequiredLoading, requiredLoading } = loading);
});

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
  let unit = 1.5;
  Object.defineProperties(game, {
    offsetHeight: { get: () => 360 * unit },
    offsetWidth: { get: () => 720 * unit },
  });
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
  expect(first.style.alignItems).toBe("center");
  expect(firstButton.style.alignSelf).toBe("");
  expect(firstButton.style.height).toBe("72px");
  expect(firstButton.style.width).toBe("192px");
  expect(firstButton.style.minHeight).toBe("0");
  expect(firstButton.style.fontSize).toBe("18px");
  expect(first.style.padding).toBe("24px 16px 16px");
  expect(first.style.maxWidth).toBe(`${LOADING_FAILURE_PRESENTATION.panel.maxWidthPx}px`);
  expect(host.style.getPropertyValue("--failure-frame-width")).toBe("1080px");
  expect(host.style.getPropertyValue("--failure-frame-height")).toBe("540px");
  const state = requiredLoading.state;
  window.dispatchEvent(new Event("resize"));
  expect(host.querySelector(".loading-failure")).toBe(first);
  firstButton.focus();
  unit = 2;
  window.dispatchEvent(new Event("resize"));
  const second = host.querySelector<HTMLElement>(".loading-failure")!;
  const secondButton = second.querySelector<HTMLButtonElement>("button")!;
  expect(second).toBe(first);
  expect(secondButton).toBe(firstButton);
  expect(first.isConnected).toBe(true);
  expect(secondButton.style.height).toBe("96px");
  expect(document.activeElement).toBe(secondButton);
  expect(requiredLoading.state).toBe(state);
  expect(retry).not.toHaveBeenCalled();
  expect(successfulRetry).not.toHaveBeenCalled();
  unit = 3;
  const leaked = vi.fn();
  window.addEventListener("keydown", leaked);
  resources.push(() => window.removeEventListener("keydown", leaked));
  secondButton.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    }),
  );
  // Synthetic key events do not run the browser's native button-click default.
  secondButton.click();
  expect(host.querySelector(".loading-failure")).toBe(second);
  expect(secondButton.disabled).toBe(true);
  const flight = requiredLoading.retry();
  expect(requiredLoading.retry()).toBe(flight);
  expect(retry).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event("resize"));
  expect(host.querySelector(".loading-failure")).toBe(second);
  expect(secondButton.disabled).toBe(true);
  expect(secondButton.style.height).toBe("144px");
  expect(secondButton.style.fontSize).toBe("18px");
  const repeat = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    repeat: true,
  });
  document.body.dispatchEvent(repeat);
  expect(leaked).not.toHaveBeenCalled();
  expect(retry).toHaveBeenCalledOnce();
  document.body.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
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

function failureHost() {
  const game = document.createElement("div");
  game.id = "game";
  Object.defineProperties(game, {
    offsetHeight: { value: 360 },
    offsetWidth: { value: 720 },
  });
  const host = document.createElement("div");
  game.append(host);
  document.body.append(game);
  stopView = mountRequiredLoading(host);
  return {
    button: () => host.querySelector<HTMLButtonElement>(".loading-failure button")!,
    failure: () => host.querySelector<HTMLElement>(".loading-failure")!,
  };
}
const settle = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

it("shows a first install's failure while boot waits on it, and Retry resumes the install once", async () => {
  const view = failureHost();
  resources.push(requiredLoading.observe({ retry: vi.fn(), status: () => "loading" }));
  expect(view.failure()).toBeNull();
  const retry = vi.fn();
  loading.installationFeedback.fail({ reason: "network", retry });
  expect(view.failure().hidden).toBe(false);
  expect(loading.installationFeedback.state).toMatchObject({ error: "network", kind: "failed" });
  view.button().click();
  view.button().click();
  expect(retry).toHaveBeenCalledOnce();
  expect(view.failure()?.hidden ?? true).toBe(true);
  await settle();
  expect(view.failure()?.hidden ?? true).toBe(true);
  expect(loading.installationFeedback.state?.kind).toBe("loading");
  const again = vi.fn();
  loading.installationFeedback.fail({ reason: "verification", retry: again });
  expect(view.failure().hidden).toBe(false);
  view.button().click();
  expect(again).toHaveBeenCalledOnce();
  expect(retry).toHaveBeenCalledOnce();
});

it("prioritizes a required failure over a failed first install", async () => {
  const view = failureHost();
  const retryInstallation = vi.fn();
  loading.installationFeedback.fail({ reason: "verification", retry: retryInstallation });
  let failed = true;
  let finishRequired!: () => void;
  const retryRequired = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishRequired = resolve;
      }),
  );
  resources.push(
    requiredLoading.observe({
      retry: retryRequired,
      status: () => (failed ? "failed" : "ready"),
    }),
  );
  view.button().click();
  expect(retryRequired).toHaveBeenCalledOnce();
  expect(retryInstallation).not.toHaveBeenCalled();
  failed = false;
  requiredLoading.invalidate();
  finishRequired();
  await settle();
  expect(view.failure().hidden).toBe(false);
  view.button().click();
  expect(retryInstallation).toHaveBeenCalledOnce();
});

it("waits for a measured failure frame without inventing a unit or changing readiness", () => {
  const game = document.createElement("div");
  game.id = "game";
  let unit = 0;
  Object.defineProperties(game, {
    offsetHeight: { get: () => 360 * unit },
    offsetWidth: { get: () => 720 * unit },
  });
  const host = document.createElement("div");
  game.append(host);
  document.body.append(game);
  resources.push(requiredLoading.observe({ retry: vi.fn(), status: () => "failed" }));
  stopView = mountRequiredLoading(host);
  expect(host.querySelector(".loading-failure")).toBeNull();
  const state = requiredLoading.state;
  unit = 0.5;
  window.dispatchEvent(new Event("resize"));
  expect(host.querySelector<HTMLElement>(".loading-failure")!.hidden).toBe(false);
  expect(host.querySelector<HTMLButtonElement>("button")!.style.height).toBe("24px");
  expect(requiredLoading.state).toBe(state);
});

it("holds Retry through its guarded factory callback once and suppresses release while busy", async () => {
  const { TOUCH } = await import("../data/touch.ts");
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(window.performance, "now").mockImplementation(() => now);
  const view = failureHost();
  const retry = vi.fn(() => new Promise<void>(() => {}));
  resources.push(requiredLoading.observe({ retry, status: () => "failed" }));
  const button = view.button();
  const pointer = (type: string) =>
    button.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX: 1,
        clientY: 1,
        isPrimary: true,
        pointerId: 1,
      }),
    );
  pointer("pointerdown");
  expect(retry).not.toHaveBeenCalled();
  now = TOUCH.actionHoldMilliseconds;
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  expect(retry).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(true);
  pointer("pointerup");
  button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
  expect(retry).toHaveBeenCalledOnce();
  stopView();
  now += TOUCH.actionHoldMilliseconds;
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  expect(retry).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
