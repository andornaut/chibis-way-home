import { describe, expect, it } from "vitest";

import { type HomeCover, type HomeScreen, trackHomeScreen } from "./homeScreen";

type Step = ["cover", HomeCover, boolean] | ["shown"];

function run(steps: readonly Step[]): boolean[] {
  const seen: boolean[] = [];
  const home: HomeScreen = trackHomeScreen((onHome) => seen.push(onHome));
  for (const step of steps) {
    if (step[0] === "shown") {
      home.shown();
    } else {
      home.cover(step[1], step[2]);
    }
  }
  return seen;
}

describe("trackHomeScreen", () => {
  it.each<{ name: string; seen: boolean[]; steps: Step[] }>([
    { name: "nothing before the zone shows", seen: [], steps: [["cover", "pauseCard", true]] },
    {
      name: "waits for prepared gameplay before registration",
      seen: [true],
      steps: [["cover", "loading", true], ["shown"], ["cover", "loading", false]],
    },
    { name: "home once the zone shows", seen: [true], steps: [["shown"], ["shown"]] },
    {
      name: "away while the pause card is open",
      seen: [true, false, true],
      steps: [["shown"], ["cover", "pauseCard", true], ["cover", "pauseCard", false]],
    },
    {
      name: "away while a conversation shows",
      seen: [true, false, true],
      steps: [["shown"], ["cover", "dialogue", true], ["cover", "dialogue", false]],
    },
    {
      name: "away during death and its required card",
      seen: [true, false, true],
      steps: [["shown"], ["cover", "death", true], ["cover", "death", false]],
    },
    {
      name: "away while a room shows",
      seen: [true, false, true],
      steps: [["shown"], ["cover", "room", true], ["cover", "room", false]],
    },
    {
      name: "home only once a cover from before the zone is gone",
      seen: [true],
      steps: [["cover", "pauseCard", true], ["shown"], ["cover", "pauseCard", false]],
    },
  ])("$name", ({ seen, steps }) => {
    expect(run(steps)).toEqual(seen);
  });
});
