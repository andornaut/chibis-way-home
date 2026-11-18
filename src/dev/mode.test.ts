import { INSTALLED_APP_DISPLAY_QUERY } from "@andornaut/game-kit/runtime/web/pwa/backNavigation";
import { expect, it } from "vitest";

import {
  beginDevelopmentSession,
  cheatsAvailable,
  developmentSkillOverrides,
  endDevelopmentSession,
  invulnerabilityEnabled,
  isDevelopmentSession,
  setInvulnerability,
  setSkillOverride,
  unlockAllPowerUps,
} from "./mode.ts";

const host = (app: boolean, standalone?: boolean) =>
  ({
    matchMedia: (query: string) => ({ matches: app && query === INSTALLED_APP_DISPLAY_QUERY }),
    navigator: { maxTouchPoints: 0, standalone, userAgent: "" },
  }) as unknown as Window;

it("offers cheats in a browser tab and never in an installed app's window", () => {
  expect([host(false), host(true), host(false, true)].map(cheatsAvailable)).toEqual([
    true,
    false,
    false,
  ]);
});

it("turns every cheat off when the session ends", () => {
  beginDevelopmentSession();
  setInvulnerability(true);
  setSkillOverride(true, "dash");
  unlockAllPowerUps();
  expect([isDevelopmentSession(), invulnerabilityEnabled(), developmentSkillOverrides()]).toEqual([
    true,
    true,
    { dash: true },
  ]);
  endDevelopmentSession();
  expect([isDevelopmentSession(), invulnerabilityEnabled(), developmentSkillOverrides()]).toEqual([
    false,
    false,
    {},
  ]);
});
