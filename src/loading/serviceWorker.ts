import type { ProgressHandle } from "@andornaut/game-kit/progressState";
import type { OfflinePage } from "@andornaut/game-kit/pwa/offlinePlay";
import type { RegistrationLike, ServiceWorkerLike } from "@andornaut/game-kit/pwa/updateReady";

import { installProgress } from "./progress";

// Worker states expose activity, not byte or resource completion. Never turn them into a percent.
export function watchInstalling(registration: RegistrationLike): void {
  let watched: ServiceWorkerLike | undefined;
  const read = () => {
    const worker = registration.installing;
    if (!worker || worker === watched) {
      return;
    }
    watched = worker;
    let operation: ProgressHandle | undefined;
    const changed = () => {
      if (worker.state === "installing" || worker.state === "activating") {
        operation ??= installProgress.begin();
      } else {
        operation?.finish();
        operation = undefined;
      }
    };
    worker.addEventListener("statechange", changed);
    changed();
  };
  registration.addEventListener("updatefound", read);
  read();
}

// Observe the registration already requested by the update flow, keeping its original due time.
export function withInstallProgress(page: OfflinePage): OfflinePage {
  const source = page.container;
  return {
    ...page,
    container: {
      addEventListener: source.addEventListener.bind(source),
      get controller() {
        return source.controller;
      },
      dispatchEvent: source.dispatchEvent.bind(source),
      register: async (url, options) => {
        const registration = await source.register(url, options);
        watchInstalling(registration);
        return registration;
      },
      removeEventListener: source.removeEventListener.bind(source),
    },
  };
}
