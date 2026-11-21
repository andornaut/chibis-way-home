import { progressBarLayout } from "@andornaut/game-kit/runtime/progress";
import { progressBarPixelProperties } from "@andornaut/game-kit/runtime/web/progress/dom/progressBar";
import { describe, expect, it, vi } from "vitest";

import { LOADING_CSS, loadingHtml } from "./html.ts";
import { afterLoadingPaint } from "./progress.ts";
import { LOADING_TIMING, PROGRESS_RECT, stageProgressStyle } from "./style.ts";

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
  it("renders the kit's pending bar before any script, clipped to the track, with the script's timing", () => {
    const html = loadingHtml('<head></head><div id="game">%GAME_LOADING%</div>');
    const { fills } = progressBarLayout(stageProgressStyle(), PROGRESS_RECT, 1);
    expect(html).toMatch(/<div class="progress-bar" data-state="pending" role="progressbar"/u);
    expect(html.match(/<div class="progress-bar-band"><div><\/div><\/div>/gu)).toHaveLength(
      fills.length,
    );
    expect(LOADING_CSS).toContain("#game-loading .progress-bar-band { overflow: hidden; }");
    fills.forEach(({ height, width, x, y }, index) => {
      const box = `left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px;`;
      expect(LOADING_CSS).toContain(`> :nth-child(${index + 2}) {\n  ${box}`);
      expect(width).toBe(PROGRESS_RECT.width);
    });
    const pixels = progressBarPixelProperties(stageProgressStyle(), LOADING_TIMING, PROGRESS_RECT);
    const segmentWidth = pixels["--progress-bar-segment-width"];
    const steps = pixels["--progress-bar-steps"];
    expect([segmentWidth, steps]).toEqual([
      expect.stringMatching(/^\d+px$/u),
      expect.stringMatching(/^\d+$/u),
    ]);
    const timingRule = [
      `--progress-bar-cycle: ${LOADING_TIMING.cycleMs}ms;`,
      `--progress-bar-fade: ${LOADING_TIMING.fadeMs}ms;`,
      `--progress-bar-full: ${LOADING_TIMING.fullMs}ms;`,
      `--progress-bar-segment: ${LOADING_TIMING.segment};`,
      `--progress-bar-segment-width: ${segmentWidth}; --progress-bar-steps: ${steps};`,
    ].join(" ");
    expect(LOADING_CSS).toContain(`#game-loading > .progress-bar {\n  ${timingRule}\n}`);
    expect(LOADING_CSS).toContain("height: 2px");
    expect(LOADING_CSS).toContain("pointer-events: none; z-index: 1;");
    expect(html).not.toContain("style=");
    expect(html).toContain("/assets/loading-");
    expect(html).not.toContain("aria-valuenow");
    expect(html).not.toContain("%GAME_LOADING%");
  });
});
