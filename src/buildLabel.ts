import { buildLabel } from "@andornaut/game-kit/web/build/buildLabel";

// This build's label, from the version and commit the kit's gameViteConfig defines.
export const BUILD_LABEL = buildLabel(__APP_VERSION__, __COMMIT__);
