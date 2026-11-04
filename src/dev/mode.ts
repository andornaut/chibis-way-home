import { INSTALLED_APP_DISPLAY_QUERY } from "@andornaut/game-kit/web/pwa/backNavigation";

import type { SkillId } from "../data/types";
import { SKILL_IDS, type SkillOverrides } from "../rules/skills";

const SKILL_PARAMS: Readonly<Record<SkillId, string>> = {
  dash: "skillDash",
  doubleJump: "skillDoubleJump",
  speedy: "skillSpeedy",
};

export function skillOverridesFromSearch(search: string): SkillOverrides {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    SKILL_IDS.map((skill) => [skill, params.get(SKILL_PARAMS[skill]) === "1"]),
  );
}

// The page's developer parameters, parsed again only when its query string changes.
let parsed:
  | {
      readonly flags: ReturnType<typeof developmentFlags>;
      readonly search: string;
      readonly skills: SkillOverrides;
    }
  | undefined;
function pageParameters(host: Window) {
  const { search } = host.location;
  if (parsed?.search !== search) {
    parsed = {
      flags: developmentFlags(search),
      search,
      skills: Object.freeze(skillOverridesFromSearch(search)),
    };
  }
  return parsed;
}

export function developmentSkillOverrides(): SkillOverrides {
  return typeof window !== "undefined" && regularBrowser(window)
    ? pageParameters(window).skills
    : {};
}

export function changeSkillOverride(host: Window, enabled: boolean, skill: SkillId): void {
  sessionStarted = true;
  const url = new URL(host.location.href);
  url.searchParams.set("devSession", "1");
  if (enabled) {
    url.searchParams.set(SKILL_PARAMS[skill], "1");
  } else {
    url.searchParams.delete(SKILL_PARAMS[skill]);
  }
  host.history.replaceState(host.history.state, "", url);
}

export function developmentFlags(search: string) {
  const params = new URLSearchParams(search);
  return {
    invulnerable: params.get("invulnerable") === "1",
    session:
      params.get("devSession") === "1" ||
      params.get("invulnerable") === "1" ||
      SKILL_IDS.some((skill) => params.get(SKILL_PARAMS[skill]) === "1"),
  };
}
let sessionStarted = false;
export function isDevelopmentSession(): boolean {
  sessionStarted ||= typeof window !== "undefined" && pageParameters(window).flags.session;
  return sessionStarted;
}
const appQueries = new WeakMap<Window, MediaQueryList>();
export function regularBrowser(host: Window): boolean {
  let query = appQueries.get(host);
  if (!query) {
    query = host.matchMedia(INSTALLED_APP_DISPLAY_QUERY);
    appQueries.set(host, query);
  }
  return (
    !query.matches &&
    !(host.navigator as Navigator & { standalone?: boolean }).standalone &&
    !host.document.fullscreenElement
  );
}
export function invulnerabilityEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    regularBrowser(window) &&
    pageParameters(window).flags.invulnerable
  );
}
export function stageDevelopmentUrl(current: string, stage: string): string {
  const url = new URL(current);
  url.searchParams.set("devSession", "1");
  url.searchParams.set("zone", stage);
  url.searchParams.delete("stagePreview");
  return url.href;
}
export function changeInvulnerability(host: Window, enabled: boolean): void {
  sessionStarted = true;
  const url = new URL(host.location.href);
  url.searchParams.set("devSession", "1");
  if (enabled) {
    url.searchParams.set("invulnerable", "1");
  } else {
    url.searchParams.delete("invulnerable");
  }
  host.history.replaceState(host.history.state, "", url);
}
