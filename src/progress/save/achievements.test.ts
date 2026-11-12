import { CelebrationQueue } from "@andornaut/game-kit/achievements";
import { memoryStorage } from "@andornaut/game-kit/save/storage";
import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS_VERSION, achievementsStore } from "./achievements.ts";

const KEY = "chibis-way-home.achievements";

describe("the earned achievements store", () => {
  it("awards once, keeps unannounced ids until announced, and reopens what it wrote", async () => {
    const storage = memoryStorage();
    const store = achievementsStore(storage);
    expect((await store.load()).save).toEqual({ earned: [], unannounced: [] });
    const first = await store.award(["escape-archie", "gift-rooms"]);
    const again = await store.award(["gift-rooms"]);
    await store.announced("escape-archie");
    const reopened = achievementsStore(storage);
    expect({
      again: again.added,
      first: first.added,
      reopened: (await reopened.load()).save,
      stored: JSON.parse((await storage.read(KEY)) ?? "null") as unknown,
    }).toEqual({
      again: [],
      first: ["escape-archie", "gift-rooms"],
      reopened: { earned: ["escape-archie", "gift-rooms"], unannounced: ["gift-rooms"] },
      stored: {
        earned: ["escape-archie", "gift-rooms"],
        unannounced: ["gift-rooms"],
        version: ACHIEVEMENTS_VERSION,
      },
    });
  });

  it("drops unknown ids on load instead of resetting", async () => {
    const storage = memoryStorage();
    await storage.write(
      KEY,
      JSON.stringify({
        earned: ["escape-archie", "escape-owl", "escape-archie", "clear-woodland"],
        unannounced: ["escape-owl", "clear-woodland", "gift-rooms"],
        version: ACHIEVEMENTS_VERSION,
      }),
    );
    const loaded = await achievementsStore(storage).load();
    expect({ save: loaded.save, status: loaded.status }).toEqual({
      save: { earned: ["escape-archie", "clear-woodland"], unannounced: ["clear-woodland"] },
      status: "loaded",
    });
  });

  it("queues each unannounced id once, in award order, until nothing blocks it", () => {
    const queue = new CelebrationQueue<string>();
    queue.push(["escape-archie", "gift-rooms"]);
    queue.push(["gift-rooms", "clear-woodland"]);
    let blocked = true;
    const held = queue.takeWhen(() => blocked);
    blocked = false;
    expect({
      first: queue.takeWhen(() => blocked),
      held,
      rest: queue.pending(),
    }).toEqual({
      first: "escape-archie",
      held: undefined,
      rest: ["gift-rooms", "clear-woodland"],
    });
  });
});
