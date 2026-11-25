import type { CrashScreenOptions } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import { afterEach, describe, expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json" with { type: "json" };
import { BIRD_FRAME, CRASH_BIRD_URL } from "../assets/index.ts";
import { PAGE_THEME_COLOURS, THEME_TEXT } from "../data/layout.ts";
import { TEXT } from "../data/text.ts";

const { install, screen } = vi.hoisted(() => {
  const screen = { stopGameOnCrash: vi.fn() };
  return {
    install: vi.fn<(options: CrashScreenOptions, page: unknown) => typeof screen>(() => screen),
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
      const attributes = new Set<string>();
      vi.stubGlobal("document", {
        documentElement: {
          hasAttribute: (name: string) => attributes.has(name),
          setAttribute: (name: string) => attributes.add(name),
          style: {
            getPropertyValue: (key: string) => properties.get(key) ?? "",
            setProperty: (key: string, value: string) => properties.set(key, value),
          },
        },
      });
      vi.stubGlobal("window", { location: { search: dev ? "?dev=1" : "" } });
      const { CRASH_SCREEN } = await import("./crashScreen.ts");
      const { bindFactoryAction } = await import("../ui/input/actionBinding.ts");
      expect(CRASH_SCREEN).toBe(screen);
      expect(install).toHaveBeenCalledOnce();
      const [options, page] = install.mock.calls[0]!;
      expect(page).toBe(window);
      expect(options).toMatchObject({ buildLabel: "test build", dev, words: TEXT.crash });
      expect(options.bindHoldAction).toBe(bindFactoryAction);
      expect(options.colours).toEqual({
        background: palette.colours.navy,
        buttonFace: palette.colours.dslate,
        buttonLip: palette.colours.navy,
        ink: palette.colours.ink,
        text: palette.colours.white,
      });
      expect(properties.get("--chibi-crash-bird-image")).toBe(`url("${CRASH_BIRD_URL}")`);
      expect(properties.get("--chibi-crash-bird-width")).toBe(`${BIRD_FRAME.width * 2}px`);
      expect(properties.get("--chibi-crash-bird-height")).toBe(`${BIRD_FRAME.height * 2}px`);
      // The page's root carries the theme the crash screen and the startup cards read: every
      // text role and every slot in its palette colour.
      expect(attributes.has("data-ui-theme")).toBe(true);
      for (const [role, style] of Object.entries(THEME_TEXT)) {
        expect(properties.get(`--ui-text-${role}-size`)).toBe(String(style.size));
        expect(properties.get(`--ui-text-${role}-line-height`)).toBe(String(style.lineHeight));
        expect(properties.get(`--ui-text-${role}-weight`)).toBe(String(style.weight));
      }
      const colours: Readonly<Record<string, string>> = palette.colours;
      for (const [role, name] of Object.entries(PAGE_THEME_COLOURS)) {
        const slot = role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        expect(properties.get(`--ui-colour-${slot}`)).toBe(colours[name]);
      }
    },
  );
});
