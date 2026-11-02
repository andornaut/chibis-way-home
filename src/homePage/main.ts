// The home page's Install button beside Play, on the kit's install button: the browser's install
// prompt where it gives one, the steps for the browser's own menu where it installs only from
// there (iOS, Firefox for Android), and hidden once installed or where neither works. Homepage
// copy from data/text.ts is rendered into pages/index.html by Vite.
import { wireInstallButton } from "../platform/pwa/installButton";
import { watchInstall } from "../platform/pwa/installFlow";

// Elements in pages/index.html. The steps dialog holds one section per browser, each marked
// data-browser with its MenuInstallBrowser and titled by its h2.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";

const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  wireInstallButton(watchInstall(window), button, steps);
}
