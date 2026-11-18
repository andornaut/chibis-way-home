import palette from "../../public/art/palette.json" with { type: "json" };

// Art's data files the code imports, by manifest key. They ship inside the bundle, so boot
// caches them rather than loading their files and the build ships no copy under /art/.
export const BUNDLED_ART_DATA: Readonly<Record<string, unknown>> = { palette };
