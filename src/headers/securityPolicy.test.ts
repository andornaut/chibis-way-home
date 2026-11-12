import { describe, expect, it } from "vitest";

import { pageProblem } from "./securityPolicy.ts";

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
