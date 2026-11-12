import { randomStream } from "@andornaut/game-kit/random";
import { expect, it } from "vitest";

import { namedStreams, scopedStreams } from "./randomStreams.ts";

const draws = (random: () => number) => [random(), random(), random()];

it("names each decision stream under its namespace and scope without sharing draws", () => {
  const streams = namedStreams(31, "agent:main:0");
  expect(draws(streams("intent:0"))).toEqual(draws(randomStream(31, "agent:main:0:intent:0")));
  expect(draws(streams("intent:0"))).toEqual(draws(streams("intent:0")));
  expect(draws(scopedStreams("periodic", streams)("2"))).toEqual(
    draws(randomStream(31, "agent:main:0:periodic:2")),
  );
  expect(draws(streams("intent:1"))).not.toEqual(draws(streams("intent:0")));
});
