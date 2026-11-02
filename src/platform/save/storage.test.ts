import { expect, it, vi } from "vitest";

import { browserStorage, lazyStorage, localSaveStorage, type StorageLike } from "./storage";

function storage(entries = new Map<string, string>()): StorageLike {
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}
it("looks up browser storage on each operation rather than retaining a stale object", async () => {
  const first = new Map<string, string>();
  let current = storage(first);
  const port = browserStorage(lazyStorage(() => current));
  await port.write("progress", "first");
  const next = new Map([["progress", "next"]]);
  current = storage(next);
  expect(await port.read("progress")).toBe("next");
  await port.write("progress", "updated");
  expect(first.get("progress")).toBe("first");
  expect(next.get("progress")).toBe("updated");
});
it("reports inaccessible browser storage as rejected read and write promises", async () => {
  const unavailable = new Error("storage unavailable");
  const port = browserStorage(
    lazyStorage(() => {
      throw unavailable;
    }),
  );
  await expect(port.read("progress")).rejects.toBe(unavailable);
  await expect(port.write("progress", "value")).rejects.toBe(unavailable);
});
it("obtains local storage lazily through the browser adapter", async () => {
  const port = localSaveStorage();
  vi.stubGlobal("localStorage", storage(new Map([["progress", "loaded"]])));
  try {
    expect(await port.read("progress")).toBe("loaded");
  } finally {
    vi.unstubAllGlobals();
  }
});
