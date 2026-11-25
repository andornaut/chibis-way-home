import { pageRules, pathMatches } from "@andornaut/game-kit/build/securityHeaders";
import {
  BUILD_POINTER_URL,
  buildGroupUrl,
  buildManifestUrl,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { describe, expect, it } from "vitest";

import {
  BASE_DIRECTIVES,
  COMMON_RULE,
  FILE_RULES,
  PAGE_RULES,
  pageProblem,
} from "./securityPolicy.ts";

const NAV_SCRIPT = '<script src="/nav.js" defer></script>';
const NAV_STYLESHEET = '<link rel="stylesheet" href="/nav.css" />';

describe("pageProblem", () => {
  it.each([
    ["no nav", "<p>Home</p>", false],
    ["the nav and its stylesheet", NAV_STYLESHEET + NAV_SCRIPT, false],
    ["the nav without its stylesheet", NAV_SCRIPT, true],
  ])("for a page with %s, fails the build: %s", (_, html, fails) => {
    expect(pageProblem({ fileName: "index.html", html }) !== undefined).toBe(fails);
  });
});

it("excludes analytics from the game while retaining website permissions and functional loading", () => {
  const inline = "'sha256-loading-script'";
  const rules = pageRules(
    BASE_DIRECTIVES,
    PAGE_RULES,
    new Map([["/play/", { scriptHashes: [inline], styleHashes: [] }]]),
  );
  const game = rules.find(({ path }) => pathMatches(path, "/play/"))!;
  const policy = game.headers.find(([name]) => name === "Content-Security-Policy")![1];
  expect(policy).not.toContain("cloudflareinsights.com");
  expect(policy).toContain(`script-src 'self' ${inline}`);
  expect(policy).toContain("connect-src 'self';");
  expect(policy).toContain("worker-src 'self';");
  expect(policy).toContain("img-src 'self' data: blob:;");
  const website = rules.find((rule) => pathMatches(rule.path, "/"))!;
  expect(website.headers[0]![1]).toContain("https://static.cloudflareinsights.com");
  expect(website.headers[0]![1]).toContain("https://cloudflareinsights.com");
  for (const path of ["/play/", "/play/index.html"]) {
    const headers = FILE_RULES.filter((rule) => pathMatches(rule.path, path)).flatMap(
      ({ headers }) => headers,
    );
    expect(headers).toContainEqual([
      "Cache-Control",
      "public, max-age=0, must-revalidate, no-transform",
    ]);
  }
  for (const path of ["/", "/sw.js"]) {
    expect(
      FILE_RULES.filter((rule) => pathMatches(rule.path, path))
        .flatMap(({ headers }) => headers)
        .some(([name, value]) => name === "Cache-Control" && value.includes("no-transform")),
    ).toBe(false);
  }
});

it("never lets a cache keep the build pointer, and keeps each build manifest for good", () => {
  const cacheControl = (path: string) =>
    [COMMON_RULE, ...FILE_RULES]
      .filter((rule) => pathMatches(rule.path, path))
      .flatMap(({ headers }) => headers)
      .filter(([name]) => name === "Cache-Control")
      .map(([, value]) => value);
  expect(cacheControl(BUILD_POINTER_URL)).toEqual(["no-store"]);
  expect(cacheControl(buildManifestUrl("0123456789abcdef"))).toEqual([
    "public, max-age=31536000, immutable",
  ]);
  expect(cacheControl("/sw.js")).toEqual([]);
});

it("serves each gzip group archive as opaque bytes that are never recoded", () => {
  const sha256 = "0123456789abcdef".repeat(4);
  const headersOf = (path: string) =>
    FILE_RULES.filter((rule) => pathMatches(rule.path, path)).flatMap(({ headers }) => headers);
  const archive = { byteSize: 2, schema: 1, sha256 } as const;
  const group = { ...archive, encodedByteSize: 1, encoding: "gzip" } as const;
  expect(headersOf(buildGroupUrl(group))).toEqual([
    ["Content-Type", "application/octet-stream"],
    ["Cache-Control", "public, max-age=31536000, immutable, no-transform"],
  ]);
  // The decoded copies and the build records keep the platform defaults.
  expect(headersOf(buildGroupUrl(archive))).toEqual([]);
  expect(headersOf("/.game-kit/group-record-0123456789abcdef.json")).toEqual([]);
});
