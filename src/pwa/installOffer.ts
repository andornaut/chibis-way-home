import { type InstallFlow, watchInstall } from "@andornaut/game-kit/web/pwa/dom/installFlow";

let flow: InstallFlow | undefined;

// The game page's install offer (the kit's install flow), which the settings card's Install row
// follows. src/main.ts calls it as the page loads, since the browser's install prompt can come
// before anything is drawn.
export function installOffer(): InstallFlow {
  flow ??= watchInstall(window);
  return flow;
}
