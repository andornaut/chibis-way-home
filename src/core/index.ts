// Geometry and time primitives every simulation layer shares: the fixed step, edge tolerance,
// rect helpers, swept contact, the terrain broadphase and sprite silhouette contact.
export {
  contactFrameAt,
  prepareSpriteContact,
  silhouetteContact,
  spriteFrameOrigin,
} from "./bodyContact.ts";
export { collisionCandidates } from "./collisionIndex.ts";
export { EDGE, rectAt, sameRect } from "./geometry.ts";
export { PLAY_STEP_LIMITS, STEP_MS, STEP_SECONDS } from "./step.ts";
export { sweptContact } from "./sweptContact.ts";
