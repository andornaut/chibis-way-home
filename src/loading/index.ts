// The page's loading: the two-pixel strip, the first install's progress and the required-resource
// failure card with Retry. The strip's style is shared with the build, which writes the loading
// HTML.
export { launchLoading } from "./launch.ts";
export { loadingFailurePresentation } from "./presentation.ts";
export {
  afterLoadingPaint,
  beginRequiredUpdate,
  beginStageLoading,
  beginStartupChecks,
  mountLoading,
  startupLoading,
} from "./progress.ts";
export {
  installationFeedback,
  mountRequiredLoading,
  observeRequiredAttempt,
  requiredLoading,
} from "./required.ts";
export { LOADING_TIMING, PROGRESS_RECT, stageProgressStyle } from "./style.ts";
