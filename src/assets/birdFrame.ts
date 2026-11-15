import birdSheet from "../../public/art/sprites/bird.json" with { type: "json" };
import type { Size } from "../data/types/index.ts";
import { ART_PATH, sheetFrameSize } from "./aseprite.ts";

export const BIRD_SHEET_URL = `${ART_PATH}sprites/bird.png`;

// His drawn frame's size, from art's bird sheet: every frame is this big.
export const BIRD_FRAME: Size = /* @__PURE__ */ sheetFrameSize(birdSheet);
