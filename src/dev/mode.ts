import { INSTALLED_APP_DISPLAY_QUERY } from "../platform/pwa/backNavigation";

export function developmentFlags(search: string) {
  const params = new URLSearchParams(search);
  return {
    invulnerable: params.get("invulnerable") === "1",
    session: params.get("devSession") === "1" || params.get("invulnerable") === "1",
  };
}
let sessionStarted = false;
export function isDevelopmentSession(): boolean {
  sessionStarted ||=
    typeof window !== "undefined" && developmentFlags(window.location.search).session;
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
    developmentFlags(window.location.search).invulnerable
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
