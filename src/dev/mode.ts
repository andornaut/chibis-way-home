import { runsInAppWindow } from "@andornaut/game-kit/runtime/web/pwa/appWindow";

import type { SkillId } from "../data/types/index.ts";
import type { SkillOverrides } from "../progress/index.ts";

// The cheats chosen for the current cheat session (gameplay/cheats.md). The session lives only in
// this page's memory: nothing stores it, so reloading or closing the game ends it, as does
// src/scenes/save.ts's endCheatSession when play returns to the start screen.
interface CheatState {
  readonly invulnerable: boolean;
  readonly powerUps: boolean;
  readonly skills: SkillOverrides;
  readonly zones: boolean;
}

const NONE: CheatState = { invulnerable: false, powerUps: false, skills: {}, zones: false };
let cheats = NONE;
let session = false;

// Whether cheats may be used here: in a browser tab, never in an installed app's window.
export function cheatsAvailable(host: Window): boolean {
  return !runsInAppWindow(host);
}

// Whether a cheat session is running: some cheat was used since the page loaded or play last
// returned to the start screen.
export function isDevelopmentSession(): boolean {
  return session;
}

export function beginDevelopmentSession(): void {
  session = true;
}

// Ends the session and turns every cheat off.
export function endDevelopmentSession(): void {
  session = false;
  cheats = NONE;
}

export function developmentSkillOverrides(): SkillOverrides {
  return cheats.skills;
}

export function invulnerabilityEnabled(): boolean {
  return cheats.invulnerable;
}

// Whether Unlock all power-ups made every power-up owned for the session.
export function allPowerUpsUnlocked(): boolean {
  return cheats.powerUps;
}

// Whether Unlock all zones opened every zone and stage on the map for the session.
export function allZonesUnlocked(): boolean {
  return cheats.zones;
}

export function setInvulnerability(enabled: boolean): void {
  cheats = { ...cheats, invulnerable: enabled };
}

export function setSkillOverride(enabled: boolean, skill: SkillId): void {
  cheats = { ...cheats, skills: Object.freeze({ ...cheats.skills, [skill]: enabled }) };
}

export function unlockAllPowerUps(): void {
  cheats = { ...cheats, powerUps: true };
}

export function unlockAllZones(): void {
  cheats = { ...cheats, zones: true };
}
