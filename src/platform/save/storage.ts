// Key-value storage for saves, as promises: a read or write that throws (private mode, quota,
// blocked site data) becomes a rejected promise, which saveStore reports as unavailable.
import type { SaveStorage } from "@andornaut/game-kit/save/contracts";

export type { SaveStorage } from "@andornaut/game-kit/save/contracts";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

// A Web Storage object (localStorage) as SaveStorage.
export function browserStorage(storage: StorageLike): SaveStorage {
  return {
    read: async (key) => storage.getItem(key),
    write: async (key, value) => {
      storage.setItem(key, value);
    },
  };
}

// Looks the storage up on each call: reading window.localStorage itself throws when the
// browser blocks site data, and this turns that into a throw from getItem or setItem, which
// browserStorage turns into a rejected promise.
export function lazyStorage(lookup: () => StorageLike): StorageLike {
  return {
    getItem: (key) => lookup().getItem(key),
    setItem: (key, value) => lookup().setItem(key, value),
  };
}

// The page's localStorage as SaveStorage, looked up on each call (lazyStorage).
export function localSaveStorage(): SaveStorage {
  return browserStorage(lazyStorage(() => globalThis.localStorage));
}
