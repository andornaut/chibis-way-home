// The game's icons, each a file under public/ at this URL: the web app manifest's, and the pages'
// favicons and apple-touch-icon. The build writes each again under a content-hashed name and
// points the pages and the manifest there (the kit's hashedIconsPlugin), so a redrawn icon
// reaches an installed app.
export const ICONS: readonly string[] = [
  "/art/favicon-16.png",
  "/art/favicon.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];
