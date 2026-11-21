import type { UpdateOffer } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { describe, expect, it, vi } from "vitest";

import { createUpdateOffer } from "./updateOffer.ts";

// A staged version's offer, whose updateNow awaits the save it is given and then settles as
// settle says.
function staged(settle: () => Promise<void> = () => new Promise<void>(() => {})) {
  const updateNow = vi.fn(async (save: () => void | PromiseLike<void>) => {
    await save();
    await settle();
  });
  return { dismiss: vi.fn(), updateNow, version: "b" } satisfies UpdateOffer;
}

describe("Update now prompt", () => {
  it("shows the kit's offer and ignores choices while none shows", () => {
    const prompt = createUpdateOffer();
    const shown = vi.fn();
    prompt.subscribe(shown);
    const save = vi.fn(async () => {});
    prompt.accept(save);
    prompt.defer();
    expect(save).not.toHaveBeenCalled();
    const offer = staged();
    prompt.offer(offer);
    expect(shown.mock.calls).toEqual([[false], [true]]);
  });

  it("dismisses once, continuing play, and shows only a later offer again", () => {
    const prompt = createUpdateOffer();
    const shown = vi.fn();
    prompt.subscribe(shown);
    const offer = staged();
    prompt.offer(offer);
    prompt.defer();
    prompt.defer();
    expect(offer.dismiss).toHaveBeenCalledOnce();
    expect(offer.updateNow).not.toHaveBeenCalled();
    expect(shown.mock.calls).toEqual([[false], [true], [false]]);
    prompt.offer(staged());
    expect(shown).toHaveBeenLastCalledWith(true);
  });

  it("passes the save to Update now once and keeps the prompt shown while it switches", async () => {
    const prompt = createUpdateOffer();
    const shown = vi.fn();
    prompt.subscribe(shown);
    const offer = staged();
    prompt.offer(offer);
    let saved!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          saved = resolve;
        }),
    );
    prompt.accept(save);
    prompt.accept(save);
    prompt.defer();
    prompt.offer(staged());
    expect(offer.updateNow).toHaveBeenCalledOnce();
    expect(offer.updateNow.mock.calls[0]![0]).toBe(save);
    expect(offer.dismiss).not.toHaveBeenCalled();
    saved();
    await Promise.resolve();
    expect(shown.mock.calls).toEqual([[false], [true]]);
  });

  it("hides the prompt and continues play when the switch fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const prompt = createUpdateOffer();
    const shown = vi.fn();
    prompt.subscribe(shown);
    const offer = staged(() => Promise.reject(new Error("no longer staged")));
    prompt.offer(offer);
    prompt.accept(async () => {});
    await vi.waitFor(() => expect(shown).toHaveBeenLastCalledWith(false));
    expect(warn).toHaveBeenCalledOnce();
    prompt.offer(staged());
    expect(shown).toHaveBeenLastCalledWith(true);
    warn.mockRestore();
  });

  it("disconnects a destroyed modal bridge", () => {
    const prompt = createUpdateOffer();
    const shown = vi.fn();
    prompt.subscribe(shown)();
    prompt.offer(staged());
    expect(shown.mock.calls).toEqual([[false]]);
  });
});
