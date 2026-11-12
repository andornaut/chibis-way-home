import birdSheet from "../../public/art/sprites/bird.json" with { type: "json" };
import type { Size } from "../data/types/index.ts";
import { sheetFrameSize } from "./aseprite.ts";

// His drawn frame's size, from art's bird sheet: every frame is this big.
export const BIRD_FRAME: Size = /* @__PURE__ */ sheetFrameSize(birdSheet);
