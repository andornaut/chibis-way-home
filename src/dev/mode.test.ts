import { afterEach, describe, expect, it, vi } from "vitest";

import {
  changeInvulnerability,
  changeSkillOverride,
  developmentFlags,
  developmentSkillOverrides,
  invulnerabilityEnabled,
  isDevelopmentSession,
  regularBrowser,
  skillOverridesFromSearch,
  stageDevelopmentUrl,
} from "./mode";

afterEach(() => vi.unstubAllGlobals());
describe("developer session routing", () => {
  it("leaves regular browser sessions normal until controls opt in and preserves debug seeds", () => {
    expect(developmentFlags("?dev=1").session).toBe(false);
    const url = new URL(
      stageDevelopmentUrl("https://example.test/play/?assembly=7&seed=9&invulnerable=1", "street"),
    );
    expect(url.searchParams.get("zone")).toBe("street");
    expect(url.searchParams.get("assembly")).toBe("7");
    expect(url.searchParams.get("seed")).toBe("9");
    expect(developmentFlags(url.search)).toEqual({ invulnerable: true, session: true });
    const page = {
      history: {
        replaceState: (_state: unknown, _title: string, next: URL) => {
          url.href = next.href;
        },
        state: null,
      },
      location: url,
    };
    vi.stubGlobal("window", page);
    changeInvulnerability(page as unknown as Window, false);
    expect(developmentFlags(url.search)).toEqual({ invulnerable: false, session: true });
    url.search = "";
    expect(isDevelopmentSession()).toBe(true);
  });
  it.each([
    { key: "skillDash", skill: "dash" },
    { key: "skillDoubleJump", skill: "doubleJump" },
    { key: "skillSpeedy", skill: "speedy" },
  ] as const)(
    "keeps $skill overrides temporary and preserves unrelated URL context",
    ({ key, skill }) => {
      const url = new URL("https://example.test/play/?seed=8&assembly=4");
      const host = {
        history: {
          replaceState: (_state: unknown, _title: string, next: URL) => {
            url.href = next.href;
          },
          state: null,
        },
        location: url,
      } as unknown as Window;
      changeSkillOverride(host, true, skill);
      expect(url.searchParams.get(key)).toBe("1");
      expect(skillOverridesFromSearch(url.search)[skill]).toBe(true);
      expect(developmentFlags(url.search).session).toBe(true);
      const routed = new URL(stageDevelopmentUrl(url.href, "street"));
      expect(routed.searchParams.get(key)).toBe("1");
      changeSkillOverride(host, false, skill);
      expect(url.searchParams.has(key)).toBe(false);
      expect(skillOverridesFromSearch(url.search)[skill]).toBe(false);
      expect(url.searchParams.get("seed")).toBe("8");
      expect(url.searchParams.get("assembly")).toBe("4");
      expect(developmentFlags(url.search).session).toBe(true);
    },
  );
  it.each([
    ["a regular browser tab", false, false, false, true],
    ["an installed display mode", true, false, false, false],
    ["an iOS standalone page", false, true, false, false],
    ["a fullscreen page", false, false, true, false],
  ])(
    "hides the controls in installed and fullscreen contexts: %s shows them %s",
    (_, installed, standalone, fullscreen, shown) => {
      const page = {
        document: { fullscreenElement: fullscreen ? {} : null },
        matchMedia: () => ({ matches: installed }),
        navigator: { standalone },
      } as unknown as Window;
      expect(regularBrowser(page)).toBe(shown);
    },
  );
  it("follows in-place URL changes to the page's developer parameters", () => {
    const url = new URL("https://example.test/play/?seed=3");
    const page = {
      document: { fullscreenElement: null },
      history: {
        replaceState: (_state: unknown, _title: string, next: URL) => {
          url.href = next.href;
        },
        state: null,
      },
      location: url,
      matchMedia: () => ({ matches: false }),
      navigator: {},
    };
    vi.stubGlobal("window", page);
    expect([invulnerabilityEnabled(), developmentSkillOverrides().dash]).toEqual([false, false]);
    changeInvulnerability(page as unknown as Window, true);
    changeSkillOverride(page as unknown as Window, true, "dash");
    expect([invulnerabilityEnabled(), developmentSkillOverrides().dash]).toEqual([true, true]);
    changeInvulnerability(page as unknown as Window, false);
    expect(invulnerabilityEnabled()).toBe(false);
  });
});
