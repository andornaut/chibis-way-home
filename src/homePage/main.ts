// The home page's Install button beside Play, on the kit's install button: the browser's install
// prompt where it holds one, otherwise the steps dialog for the browser's own install steps, and
// hidden once installed. Homepage copy from data/text.ts is rendered into pages/index.html by
// Vite. The production page also registers the game's router worker without installing, so an
// app installed from this page opens through the router, offline once the game has installed.
import { wireInstallButton } from "@andornaut/game-kit/runtime/web/pwa/dom/installButton";
import { watchInstall } from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
import { registerRouter } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

// Elements in pages/index.html. The steps dialog holds one section per InstallStepsKind, each
// marked data-steps with its kind and titled by its h2.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";
// The router worker the build writes, which the game page's launch also registers
// (SERVICE_WORKER_URL in src/pwa/cachePolicy.ts).
const ROUTER_URL = "/sw.js";

const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  wireInstallButton(watchInstall(window), button, steps);
}
// The dev server has no sw.js.
if (import.meta.env.PROD) {
  void registerRouter(
    "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    ROUTER_URL,
  );
}
