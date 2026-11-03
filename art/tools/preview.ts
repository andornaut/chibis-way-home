import { readFileSync } from "node:fs";

import { renderContactSheet, rgb, type Sprite } from "@andornaut/art-kit/generate";

interface PreviewRequest {
  palette: Record<string, string>;
  sprites: Sprite[];
  grounds: string[];
  background: string;
  scale: number;
  gap: number;
}

const out = process.argv[2];
if (!out) {
  throw new Error("Usage: preview.ts OUT.png, with sprite preview JSON on stdin");
}
const request: PreviewRequest = JSON.parse(readFileSync(0, "utf8"));
const resolveRgb = (colour: string) => rgb(request.palette[colour] ?? colour);

await renderContactSheet(
  {
    resolveRgb,
    background: resolveRgb(request.background),
    scale: request.scale,
    gap: request.gap,
  },
  request.sprites,
  request.grounds,
).toFile(out);
