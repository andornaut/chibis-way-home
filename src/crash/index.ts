// The page's crash screen. src/play.ts, the page's first module, imports this module first:
// modules run in import order, a module's own imports first, so the crash screen listens before
// the loading strip, Phaser or any game module runs, and an error thrown while one loads shows it
// rather than a blank page. The screen imports only its words, the palette and the bird's sheet
// description, not Phaser or the game, so it stays in the entry chunk.
export { CRASH_SCREEN } from "./crashScreen.ts";
