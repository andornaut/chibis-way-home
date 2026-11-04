import type { CrashScreenOptions } from "@andornaut/game-kit/web/crash/dom/crashScreen";
import { afterEach, describe, expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json";
import bird from "../../public/art/sprites/bird.json";
import { TEXT } from "../data/text";

const { install, screen } = vi.hoisted(() => {
  const screen = { stopGameOnCrash: vi.fn() };
  return {
    install: vi.fn<(page: unknown, options: CrashScreenOptions) => typeof screen>(() => screen),
    screen,
  };
});
vi.mock("@andornaut/game-kit/web/crash/dom/crashScreen", () => ({ installCrashScreen: install }));
vi.mock("@andornaut/game-kit/web/build/buildLabel", () => ({ buildLabel: () => "test build" }));

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
      const { CRASH_SCREEN } = await import("./install");
      expect(CRASH_SCREEN).toBe(screen);
      expect(install).toHaveBeenCalledOnce();
      const options = install.mock.calls[0]![1];
      expect(options).toMatchObject({ buildLabel: "test build", dev, words: TEXT.crash });
      expect(options.colours).toEqual({
        background: palette.colours.navy,
        buttonFace: palette.colours.dslate,
        buttonLip: palette.colours.navy,
        ink: palette.colours.ink,
        text: palette.colours.white,
      });
      expect(properties.get("--chibi-crash-card-face")).toBe(palette.colours.lgrey);
      expect(properties.get("--chibi-crash-focus")).toBe(palette.colours.yellow);

      // The fallback crops the seated end of the death tag, without animation or canvas access.
      const death = bird.meta.frameTags.find((tag) => tag.name === "death")!;
      const seated = Object.values(bird.frames)[death.to]!;
      expect(seated.rotated || seated.trimmed).toBe(false);
      const width = Number.parseInt(properties.get("--chibi-crash-bird-width")!, 10);
      const scale = width / seated.frame.w;
      expect(Number.isInteger(scale) && scale >= 1).toBe(true);
      expect(properties.get("--chibi-crash-bird-height")).toBe(`${seated.frame.h * scale}px`);
      expect(properties.get("--chibi-crash-bird-position")).toBe(
        `${-seated.frame.x * scale}px ${-seated.frame.y * scale}px`,
      );
      expect(properties.get("--chibi-crash-bird-sheet-size")).toBe(
        `${bird.meta.size.w * scale}px ${bird.meta.size.h * scale}px`,
      );
    },
  );
});
