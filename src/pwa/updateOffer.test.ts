import { describe, expect, it, vi } from "vitest";

import { createUpdateOffer } from "./updateOffer";

describe("native update offer bridge", () => {
  it.each(["accept", "defer"] as const)(
    "delegates %s once only while its controls are visible",
    (action) => {
      const accept = vi.fn();
      const dismiss = vi.fn();
      const shown = vi.fn();
      const offer = createUpdateOffer(accept, dismiss);
      offer.subscribe(shown);
      offer[action]();
      expect(accept).not.toHaveBeenCalled();
      expect(dismiss).not.toHaveBeenCalled();
      offer.setVisible(true);
      offer[action]();
      offer[action]();
      expect(shown.mock.calls).toEqual([[false], [true], [false]]);
      expect(accept).toHaveBeenCalledTimes(action === "accept" ? 1 : 0);
      expect(dismiss).toHaveBeenCalledTimes(action === "defer" ? 1 : 0);
      offer.setVisible(false);
      expect(shown).toHaveBeenCalledTimes(3);
      offer.setVisible(true);
      expect(shown).toHaveBeenLastCalledWith(true);
    },
  );

  it("disconnects a destroyed native modal bridge without replacing shared visit state", () => {
    const offer = createUpdateOffer(vi.fn(), vi.fn());
    const shown = vi.fn();
    const unsubscribe = offer.subscribe(shown);
    unsubscribe();
    offer.setVisible(true);
    expect(shown.mock.calls).toEqual([[false]]);
  });
});
