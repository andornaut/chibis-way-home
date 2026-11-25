import { expect, it } from "vitest";

import { namedUrls, shippedPublicFiles } from "./publicFiles.ts";

const encoder = new TextEncoder();

function publicDir(files: Readonly<Record<string, string>>) {
  return async (url: string) => (url in files ? encoder.encode(files[url]) : undefined);
}

it("names root-relative URLs in attributes, CSS and script strings, without queries", () => {
  const text =
    '<link href="/nav.css"><img src="/art/logo.png?v=2">' +
    'a{background:url(/art/b.png)} s="/play/";t=`/x.js#y`; //comment /not/quoted';
  expect(namedUrls(text)).toEqual(["/nav.css", "/art/logo.png", "/art/b.png", "/play/", "/x.js"]);
});

it("ships named public files and what shipped scripts and styles name, but nothing else", async () => {
  const read = publicDir({
    "/art/a.png": "",
    "/art/logo.png": "",
    "/art/unused.png": "",
    "/favicon.ico": "",
    "/nav.css": 'b{background:url("/art/a.png")}',
    "/nav.js": 'img.src="/art/logo.png"; link="/nav.css"',
  });
  const built = (url: string) => url === "/assets/main.js";
  const shipped = await shippedPublicFiles(
    { built, read },
    ["/favicon.ico"],
    ['<script src="/nav.js"></script><script src="/assets/main.js"></script><a href="/play/">'],
  );
  expect([...shipped.keys()].sort()).toEqual([
    "/art/a.png",
    "/art/logo.png",
    "/favicon.ico",
    "/nav.css",
    "/nav.js",
  ]);
});

it("fails for an unnamed file the public directory lacks", async () => {
  await expect(
    shippedPublicFiles({ built: () => false, read: publicDir({}) }, ["/favicon.ico"], []),
  ).rejects.toThrow("/favicon.ico is not in the public directory");
});
