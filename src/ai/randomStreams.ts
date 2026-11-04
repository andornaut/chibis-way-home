import { type Random, randomStream } from "@andornaut/game-kit/random";

// An explicit factory of independent seeded streams, one per decision key. The caller owns the
// seed and namespace; equal keys replay equal draws without consuming a shared stream.
export type RandomStreams = (key: string) => Random;

export function namedStreams(seed: number, namespace: string): RandomStreams {
  return (key) => randomStream(seed, `${namespace}:${key}`);
}

// Streams under a sub-namespace, independent of every other scope of the same parent.
export function scopedStreams(scope: string, streams: RandomStreams): RandomStreams {
  return (key) => streams(`${scope}:${key}`);
}
