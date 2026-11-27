import {
  bindForegroundInput,
  type ForegroundInput,
} from "@andornaut/game-kit/runtime/web/input/dom/foregroundInput";

const owners = new WeakMap<Document, ForegroundInput>();
const escapes = new WeakMap<Document, () => (() => void) | undefined>();

// Installed by the first-paint crash adapter, shared across game retirement and recovery.
export function foregroundInput(document: Document): ForegroundInput {
  let owner = owners.get(document);
  if (owner === undefined) {
    owner = bindForegroundInput({ gameEscape: () => escapes.get(document)?.() }, document);
    owners.set(document, owner);
  }
  return owner;
}

export function foregroundGameEscape(
  document: Document,
  resolve: () => (() => void) | undefined,
): () => void {
  foregroundInput(document);
  escapes.set(document, resolve);
  return () => {
    if (escapes.get(document) === resolve) {
      escapes.delete(document);
    }
  };
}
