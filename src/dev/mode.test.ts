import { expect, it } from "vitest";

import {
  beginDevelopmentSession,
  developmentSkillOverrides,
  endDevelopmentSession,
  invulnerabilityEnabled,
  isDevelopmentSession,
  setInvulnerability,
  setSkillOverride,
  unlockAllPowerUps,
} from "./mode.ts";

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
