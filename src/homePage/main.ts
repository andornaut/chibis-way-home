// The home page's Install button beside Play, on the kit's install button: the browser's install
// prompt where it holds one, otherwise the steps dialog for the browser's own install steps, and
// hidden once installed. Homepage copy from data/text.ts is rendered into pages/index.html by
// Vite.
import { wireInstallButton } from "@andornaut/game-kit/web/pwa/dom/installButton";
import { watchInstall } from "@andornaut/game-kit/web/pwa/dom/installFlow";

// Elements in pages/index.html. The steps dialog holds one section per InstallStepsKind, each
// marked data-steps with its kind and titled by its h2.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";

const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  wireInstallButton(watchInstall(window), button, steps);
}
