import { describe, expect, it, vi } from "vitest";

import { LOADING_CSS, loadingHtml } from "./html";
import { afterLoadingPaint, installProgress, loadingProgress } from "./progress";
import { offlineActivity } from "./serviceWorker";

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
  it("maps actual offline activity to pending without changing foreground loading", () => {
    const seen: unknown[] = [];
    const foreground: unknown[] = [];
    const off = installProgress.subscribe((state) => seen.push(state));
    const offForeground = loadingProgress.subscribe((state) => foreground.push(state));
    const current = loadingProgress.begin();
    current.progress(0.4);
    for (const activity of ["idle", "registering", "installing", "idle"] as const) {
      offlineActivity(activity);
      expect(seen.at(-1)).toEqual({ active: activity !== "idle", value: undefined });
      expect(foreground.at(-1)).toEqual({ active: true, value: 0.4 });
    }
    current.finish();
    off();
    offForeground();
  });
  it("renders a pending accessible strip in the initial HTML without a percentage", () => {
    const html = loadingHtml('<head></head><div id="game">%GAME_LOADING%</div>');
    expect(html).toContain('role="progressbar"');
    expect(LOADING_CSS).toContain("height: 2px");
    expect(LOADING_CSS).toContain("pointer-events: none; z-index: 1;");
    expect(LOADING_CSS).toContain(
      "#game[data-modal-open] canvas { position: relative; z-index: 2; }",
    );
    expect(html).not.toContain("style=");
    expect(html).toContain("/assets/loading-");
    expect(html).not.toContain("aria-valuenow");
    expect(html).not.toContain("%GAME_LOADING%");
  });
});
