// The security headers the build writes to dist/_headers, which Cloudflare serves with every
// static asset. The kit's securityHeadersPlugin adds the hashes of each page's inline <script>
// and <style> blocks to its rule's policy, so this module names only the sources a page loads.
import type {
  Directives,
  HeaderList,
  HtmlPage,
  PageRule,
} from "../platform/headers/securityHeaders";

// Where the build writes its content-hashed files, as a _headers path pattern.
export const HASHED_ASSET_PATH = "/assets/*";

// On every response. No Cache-Control: every file but FILE_RULES' hashed build output keeps the
// platform default (max-age=0, must-revalidate), which the service worker relies on to see a new
// /sw.js on the next launch.
export const COMMON_RULE = {
  comment: "Every response. The pages ask for fullscreen to lock landscape.",
  headers: [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    [
      "Permissions-Policy",
      "fullscreen=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    ],
  ] satisfies HeaderList,
  path: "/*",
} as const;

// Headers for files rather than pages. Cloudflare sets a header a rule names, replacing its own.
export const FILE_RULES = [
  {
    comment:
      "Bitmap font descriptors, which are XML. Cloudflare types files by extension and serves " +
      "an unknown one untyped, which it does not compress.",
    headers: [["Content-Type", "text/xml; charset=utf-8"]] satisfies HeaderList,
    path: "/*.fnt",
  },
  {
    comment:
      "Content-hashed build output: a changed file gets a new name, so a cached copy never " +
      "needs revalidating.",
    headers: [["Cache-Control", "public, max-age=31536000, immutable"]] satisfies HeaderList,
    path: HASHED_ASSET_PATH,
  },
] as const;

// Every page's policy before its rule's sources and hashes are added. Phaser loads images
// through blob: URLs and its default textures as data: URIs.
export const BASE_DIRECTIVES: Directives = {
  "base-uri": ["'self'"],
  "connect-src": ["'self'"],
  "default-src": ["'self'"],
  "font-src": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "img-src": ["'self'", "data:", "blob:"],
  "manifest-src": ["'self'"],
  "media-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "worker-src": ["'self'"],
};

// Each built HTML page must match exactly one of these, or the build fails: two matching
// policies would join into one header and the browser would enforce both.
export const PAGE_RULES: readonly PageRule[] = [
  { comment: "The home page.", directives: {}, path: "/" },
  { comment: "The game.", directives: {}, path: "/play/*" },
];

const NAV_SCRIPT_PATTERN = /<script\b[^>]*\ssrc\s*=\s*["']?\/nav\.js["'\s>]/i;
const NAV_STYLESHEET_PATTERN = /<link\b[^>]*\shref\s*=\s*["']?\/nav\.css["'\s>]/i;

// Why the build must fail for a page, or undefined when it need not: a page that loads /nav.js
// must link /nav.css, since the CSP has no hash for a <style> a script adds.
export function pageProblem({ fileName, html }: HtmlPage): string | undefined {
  return NAV_SCRIPT_PATTERN.test(html) && !NAV_STYLESHEET_PATTERN.test(html)
    ? `${fileName} loads /nav.js but does not link /nav.css, so its nav bar would be unstyled`
    : undefined;
}
