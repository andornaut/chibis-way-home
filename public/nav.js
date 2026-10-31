// The site navigation bar: art's logo, linking home, then Home and Play. A page loads it with
// <link rel="stylesheet" href="/nav.css"> and <script src="/nav.js" defer></script> in its head
// and adds nothing else. The page links the stylesheet, rather than this script injecting it, so
// the bar's style blocks the first paint. On /play/ the bar is a narrow column on the left, so the
// game keeps the height, with art's icon logo at its top; on every other page it is a row with
// art's one-line logo at its left. On /play/ in the installed app (fullscreen or standalone
// display mode, or iOS's navigator.standalone) there is no bar, so no link leaves the app and the
// game takes the full height.
(() => {
  "use strict";
  // Cloudflare serves /x.html as /x and /dir/index.html as /dir/, so compare without either.
  const norm = (path) => path.replace(/(index)?\.html$/, "").replace(/\/$/, "");
  const here = norm(location.pathname);

  const nav = document.createElement("nav");
  const slim = here === "/play";
  nav.className = slim ? "site-nav slim" : "site-nav";
  nav.setAttribute("aria-label", "Site");
  const ul = document.createElement("ul");
  nav.append(ul);

  const item = (text, href) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = text;
    a.href = href;
    if (norm(href) === here) a.setAttribute("aria-current", "page");
    li.append(a);
    return li;
  };
  // Art's logos, at 1x: art/README.md, Logo.
  const logo = slim
    ? { height: 41, src: "/art/logo-icon.png", width: 53 }
    : { height: 30, src: "/art/logo-nav.png", width: 250 };
  const li = document.createElement("li");
  li.className = "site-nav-logo";
  const a = document.createElement("a");
  a.className = "site-logo";
  a.href = "/";
  const img = document.createElement("img");
  img.src = logo.src;
  img.alt = "Chibi's way home";
  img.width = logo.width;
  img.height = logo.height;
  a.append(img);
  li.append(a);
  ul.append(li);
  ul.append(item("Home", "/"), item("Play", "/play/"));

  const installed = matchMedia("(display-mode: fullscreen), (display-mode: standalone)");
  const hide = () => slim && (installed.matches || navigator.standalone === true);
  const mount = () => {
    if (hide()) nav.remove();
    else if (!nav.isConnected) document.body.prepend(nav);
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
  installed.addEventListener("change", mount);
})();
