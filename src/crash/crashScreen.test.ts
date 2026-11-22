import { readFileSync } from "node:fs";

import type { CrashScreenOptions } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import { afterEach, describe, expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json" with { type: "json" };
import { BIRD_FRAME, CRASH_BIRD_URL } from "../assets/index.ts";
import { TEXT } from "../data/text.ts";

const { install, screen } = vi.hoisted(() => {
  const screen = { stopGameOnCrash: vi.fn() };
  return {
    install: vi.fn<(page: unknown, options: CrashScreenOptions) => typeof screen>(() => screen),
    screen,
  };
});
vi.mock("@andornaut/game-kit/runtime/web/crash/dom/crashScreen", () => ({
  installCrashScreen: install,
}));
vi.mock("@andornaut/game-kit/runtime/web/buildLabel", () => ({ buildLabel: () => "test build" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("native crash screen adapter", () => {
  it.each([false, true])(
    "installs before the renderer, retaining diagnostics=%s and reload words",
    async (dev) => {
      vi.resetModules();
      const properties = new Map<string, string>();
      vi.stubGlobal("document", {
        documentElement: {
          style: { setProperty: (key: string, value: string) => properties.set(key, value) },
        },
      });
      vi.stubGlobal("window", { location: { search: dev ? "?dev=1" : "" } });
      const { CRASH_SCREEN } = await import("./crashScreen.ts");
      const { bindFactoryAction } = await import("../ui/input/actionBinding.ts");
      expect(CRASH_SCREEN).toBe(screen);
      expect(install).toHaveBeenCalledOnce();
      const options = install.mock.calls[0]![1];
      expect(options).toMatchObject({ buildLabel: "test build", dev, words: TEXT.crash });
      expect(options.bindHoldAction).toBe(bindFactoryAction);
      expect(options.colours).toEqual({
        background: palette.colours.navy,
        buttonFace: palette.colours.dslate,
        buttonLip: palette.colours.navy,
        ink: palette.colours.ink,
        text: palette.colours.white,
      });
      expect(properties.get("--chibi-crash-card-face")).toBe(palette.colours.lgrey);
      expect(properties.get("--chibi-crash-focus")).toBe(palette.colours.yellow);
      expect(properties.get("--chibi-crash-bird-image")).toBe(`url("${CRASH_BIRD_URL}")`);
      expect(properties.get("--chibi-crash-bird-width")).toBe(`${BIRD_FRAME.width * 2}px`);
      expect(properties.get("--chibi-crash-bird-height")).toBe(`${BIRD_FRAME.height * 2}px`);
      const css = readFileSync("src/crash/theme.css", "utf8");
      expect(css).toContain("background-image: var(--chibi-crash-bird-image)");
      expect(css).toContain("background-size: 100% 100%");
      expect(css).not.toContain("--chibi-crash-bird-position");
      expect(css).not.toContain("--chibi-crash-bird-sheet-size");
    },
  );
});
