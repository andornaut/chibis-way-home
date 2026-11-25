// Measured layouts in the HTML UI: kit action groups and modal frames place their parts from
// sizes measured in the page, so each registers its layout on its element and the UI layer runs
// it when the element, an ancestor or its content changes (watchLayouts), on a refit and when
// the fonts load. A layout that is not rendered is skipped and runs once it shows.

const layouts = new WeakMap<Element, () => void>();
const MARK = "data-ui-layout";

// Whether element has a box to measure.
export function rendered(element: Element): boolean {
  return element.isConnected && element.getBoundingClientRect().width > 0;
}

// Registers element's layout, which runs now where element is rendered.
export function registerLayout(layout: () => void, element: HTMLElement): void {
  layouts.set(element, layout);
  element.setAttribute(MARK, "");
  layout();
}

function depth(element: Element): number {
  let count = 0;
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    count += 1;
  }
  return count;
}

function run(elements: ReadonlySet<Element>): void {
  // Inner layouts first: a frame measures the groups inside it.
  for (const element of [...elements].sort((left, right) => depth(right) - depth(left))) {
    if (element.isConnected) {
      layouts.get(element)?.();
    }
  }
}

// Runs every layout registered in root, and root's own.
export function layoutWithin(root: Element): void {
  run(
    new Set([...(root.matches(`[${MARK}]`) ? [root] : []), ...root.querySelectorAll(`[${MARK}]`)]),
  );
}

// Runs the layouts a change in root touches: those holding the changed node, and those inside a
// node that was shown, hidden or added. Returns its removal.
export function watchLayouts(root: HTMLElement): () => void {
  let running = false;
  const observer = new MutationObserver((records) => {
    if (running) {
      return;
    }
    const touched = new Set<Element>();
    for (const { addedNodes, target, type } of records) {
      const element = target instanceof Element ? target : target.parentElement;
      for (let at = element?.closest(`[${MARK}]`); at != null;) {
        touched.add(at);
        at = at.parentElement?.closest(`[${MARK}]`);
      }
      const inside = type === "attributes" ? [element] : [...addedNodes];
      for (const node of inside) {
        if (node instanceof Element) {
          node.querySelectorAll(`[${MARK}]`).forEach((found) => touched.add(found));
        }
      }
    }
    running = true;
    try {
      run(touched);
    } finally {
      // The layouts' own changes are delivered after this callback; drop them.
      observer.takeRecords();
      running = false;
    }
  });
  observer.observe(root, {
    attributeFilter: ["hidden"],
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  const fonts = root.ownerDocument.fonts;
  const refresh = () => layoutWithin(root);
  fonts?.addEventListener("loadingdone", refresh);
  return () => {
    observer.disconnect();
    fonts?.removeEventListener("loadingdone", refresh);
  };
}
