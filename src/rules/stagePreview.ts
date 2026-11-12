import { clamp } from "@andornaut/game-kit/numbers";

import type { Point, Size } from "../data/types/index.ts";
import { askedSeed } from "./pageParams.ts";

export interface StagePreview {
  readonly area?: string;
  readonly assemblySeed: number;
  readonly key: string;
  readonly motionSeed: number;
  readonly scroll: Point;
}

// Screenshot mode is explicit and rejects incomplete requests instead of generating new seeds.
export function askedStagePreview(
  keys: readonly string[],
  search: string,
): StagePreview | undefined {
  const params = new URLSearchParams(search);
  if (!params.has("stagePreview")) {
    return undefined;
  }
  const key = params.get("stagePreview");
  const assemblySeed = askedSeed("assembly", search);
  const motionSeed = askedSeed("seed", search);
  const numberParam = (name: string) => {
    const raw = params.get(name);
    return raw === null || raw === "" ? NaN : Number(raw);
  };
  const x = numberParam("previewX");
  const y = numberParam("previewY");
  const area = params.get("previewArea");
  if (
    !key ||
    !keys.includes(key) ||
    assemblySeed === undefined ||
    motionSeed === undefined ||
    ![x, y].every((value) => Number.isFinite(value) && value >= 0) ||
    area === ""
  ) {
    throw new Error("Invalid stage preview request");
  }
  return { assemblySeed, key, motionSeed, scroll: { x, y }, ...(area !== null && { area }) };
}

export function stagePreviewScroll(view: Size, area: Size, scroll: Point): Point {
  return {
    x: clamp(0, Math.max(0, area.width - view.width), scroll.x),
    y: clamp(0, Math.max(0, area.height - view.height), scroll.y),
  };
}
