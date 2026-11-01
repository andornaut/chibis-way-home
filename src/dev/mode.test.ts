import { afterEach, describe, expect, it, vi } from "vitest";

import {
  changeInvulnerability,
  developmentFlags,
  isDevelopmentSession,
  regularBrowser,
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
  it("hides the controls in installed and fullscreen contexts", () => {
    const page = (installed: boolean, standalone: boolean, fullscreen: boolean) =>
      ({
        document: { fullscreenElement: fullscreen ? {} : null },
        matchMedia: () => ({ matches: installed }),
        navigator: { standalone },
      }) as unknown as Window;
    expect(regularBrowser(page(false, false, false))).toBe(true);
    expect(regularBrowser(page(true, false, false))).toBe(false);
    expect(regularBrowser(page(false, true, false))).toBe(false);
    expect(regularBrowser(page(false, false, true))).toBe(false);
  });
});
