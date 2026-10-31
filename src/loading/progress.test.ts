import type { OfflinePage } from "@andornaut/game-kit/pwa/offlinePlay";
import { describe, expect, it, vi } from "vitest";

import { LOADING_CSS, loadingHtml } from "./html";
import { afterLoadingPaint, installProgress, loadingProgress } from "./progress";
import { watchInstalling, withInstallProgress } from "./serviceWorker";

class Worker extends EventTarget {
  state = "installing";
  postMessage(): void {}
}
class Registration extends EventTarget {
  installing: Worker | null = new Worker();
  waiting = null;
  async update(): Promise<void> {}
}

describe("loading lifecycle", () => {
  it("does not run synchronous preparation until the pending frame can paint, and cancels shutdown work", () => {
    const frames: FrameRequestCallback[] = [];
    const schedule = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };
    const work = vi.fn();
    afterLoadingPaint(work, schedule);
    frames.shift()!(0);
    expect(work).not.toHaveBeenCalled();
    frames.shift()!(16);
    expect(work).toHaveBeenCalledOnce();
    const cancel = afterLoadingPaint(work, schedule);
    frames.shift()!(32);
    cancel();
    frames.shift()!(48);
    expect(work).toHaveBeenCalledOnce();
  });
  it("observes existing registration requests without registering early or inventing install percentages", async () => {
    const registration = new Registration();
    const register = vi.fn(async () => registration);
    const source = Object.assign(new EventTarget(), { controller: null, register });
    const page = { container: source } as unknown as OfflinePage;
    const wrapped = withInstallProgress(page);
    expect(register).not.toHaveBeenCalled();
    const seen: unknown[] = [];
    const off = installProgress.subscribe((state) => seen.push(state));
    expect(await wrapped.container.register("/sw.js", { scope: "/" })).toBe(registration);
    expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js", { scope: "/" });
    expect(seen.at(-1)).toEqual({ active: true, value: undefined });
    const operation = loadingProgress.begin();
    operation.progress(0.4);
    registration.installing!.state = "installed";
    registration.installing!.dispatchEvent(new Event("statechange"));
    expect(seen.at(-1)).toEqual({ active: false, value: undefined });
    operation.finish();
    off();
  });
  it("ends a failed install and follows the next actual update", () => {
    const registration = new Registration();
    const seen: unknown[] = [];
    const off = installProgress.subscribe((state) => seen.push(state));
    watchInstalling(registration);
    registration.installing!.state = "redundant";
    registration.installing!.dispatchEvent(new Event("statechange"));
    expect(seen.at(-1)).toEqual({ active: false, value: undefined });
    registration.installing = new Worker();
    registration.dispatchEvent(new Event("updatefound"));
    expect(seen.at(-1)).toEqual({ active: true, value: undefined });
    registration.installing.state = "activated";
    registration.installing.dispatchEvent(new Event("statechange"));
    off();
  });
  it("renders a pending accessible strip in the initial HTML without a percentage", () => {
    const html = loadingHtml('<head></head><div id="game">%GAME_LOADING%</div>');
    expect(html).toContain('role="progressbar"');
    expect(LOADING_CSS).toContain("height: 2px");
    expect(html).not.toContain("style=");
    expect(html).toContain("/assets/loading-");
    expect(html).not.toContain("aria-valuenow");
    expect(html).not.toContain("%GAME_LOADING%");
  });
});
