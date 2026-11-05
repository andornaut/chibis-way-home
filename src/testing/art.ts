import { ARCHETYPES } from "../data/archetypes";
import { CHARACTERS } from "../data/characters";
import { nodeArt } from "../sim/catalogue";

// Art's hitboxes and tilesets from public/art/, read the same under Vitest and plain Node.
const ART = nodeArt();
export const CATALOGUE = { archetypes: ARCHETYPES, characters: CHARACTERS };
export const HITBOXES = ART.hitboxes;
export const TILESETS = ART.tilesets;
