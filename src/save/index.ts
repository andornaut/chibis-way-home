// The page save: progress, achievements and stats in the browser's storage, over the save formats
// in src/progress. src/scenes/save.ts instantiates it once. It reads every zone's data, so the
// page's first module never imports it.
export { createPageSave, type PageSave, type SaveAge } from "./pageSave.ts";
