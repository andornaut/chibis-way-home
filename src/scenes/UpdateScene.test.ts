import { beforeEach, expect, it, vi } from "vitest";

const offer = vi.hoisted(() => ({ accept: vi.fn(), defer: vi.fn() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa", () => ({ updateOffer: offer }));

import { UpdateScene } from "./UpdateScene";

beforeEach(() => vi.clearAllMocks());

it.each(["accept", "cancel", "close"] as const)(
  "guards native %s actions until backdrop input is ready",
  (action) => {
    const scene = Object.assign(new UpdateScene(), { readyToInteract: false }) as unknown as {
      act(action: "accept" | "cancel" | "close"): void;
      readyToInteract: boolean;
    };
    scene.act(action);
    expect(offer.accept).not.toHaveBeenCalled();
    expect(offer.defer).not.toHaveBeenCalled();
    scene.readyToInteract = true;
    scene.act(action);
    expect(offer.accept).toHaveBeenCalledTimes(action === "accept" ? 1 : 0);
    expect(offer.defer).toHaveBeenCalledTimes(action === "accept" ? 0 : 1);
  },
);
