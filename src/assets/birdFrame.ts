import birdSheet from "../../public/art/sprites/bird.json";
import type { Size } from "../data/types";
import { sheetFrameSize } from "./aseprite";

// Her drawn frame's size, from art's bird sheet: every frame is this big.
export const BIRD_FRAME: Size = sheetFrameSize(birdSheet);
