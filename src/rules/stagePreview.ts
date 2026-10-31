import type { Point, Size } from "../data/types";
import { askedAssemblySeed } from "./zoneChain";

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
  const assemblySeed = askedAssemblySeed(search);
  const numberParam = (name: string) => {
    const raw = params.get(name);
    return raw === null || raw === "" ? NaN : Number(raw);
  };
  const motionSeed = numberParam("seed");
  const x = numberParam("previewX");
  const y = numberParam("previewY");
  const area = params.get("previewArea");
  if (
    !key ||
    !keys.includes(key) ||
    assemblySeed === undefined ||
    !Number.isSafeInteger(motionSeed) ||
    motionSeed <= 0 ||
    ![x, y].every((value) => Number.isFinite(value) && value >= 0) ||
    area === ""
  ) {
    throw new Error("Invalid stage preview request");
  }
  return { assemblySeed, key, motionSeed, scroll: { x, y }, ...(area !== null && { area }) };
}

export function stagePreviewScroll(view: Size, area: Size, scroll: Point): Point {
  return {
    x: Math.max(0, Math.min(Math.max(0, area.width - view.width), scroll.x)),
    y: Math.max(0, Math.min(Math.max(0, area.height - view.height), scroll.y)),
  };
}
