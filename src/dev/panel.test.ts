import { afterEach, describe, expect, it, vi } from "vitest";

import { DEV_TEXT } from "../data/dev";
import { ZONE_MAP } from "../data/map";
import { developerStages, mountDeveloperPanel, panelInputGate } from "./panel";

class Element extends EventTarget {
  attributes = new Map<string, string>();
  checked = false;
  children: Element[] = [];
  className = "";
  disabled = false;
  hidden = false;
  id = "";
  parentNode: Element | undefined;
  textContent = "";
  type = "";
  private selected: string | undefined;
  constructor(
    readonly ownerDocument: FakeDocument,
    readonly tag: string,
  ) {
    super();
  }
  focus() {}
  get options() {
    return this.children;
  }
  get value(): string {
    return this.selected ?? this.children[0]?.value ?? "";
  }
  set value(value: string) {
    this.selected = value;
  }
  append(...nodes: Element[]) {
    nodes.forEach((node) => {
      node.remove();
      node.parentNode = this;
      this.children.push(node);
    });
  }
  before(node: Element) {
    const parent = this.parentNode!;
    const at = parent.children.indexOf(this);
    node.remove();
    node.parentNode = parent;
    parent.children.splice(at, 0, node);
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    }
    this.parentNode = undefined;
  }
  replaceChildren() {
    this.children = [];
    this.selected = undefined;
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  getAttribute(key: string) {
    return this.attributes.get(key) ?? null;
  }
}
class FakeDocument extends EventTarget {
  defaultView = {
    document: { fullscreenElement: null },
    location: new URL("https://example.test/play/"),
    matchMedia: () => ({ addEventListener() {}, matches: false, removeEventListener() {} }),
    navigator: {},
  };
  createElement(tag: string) {
    return new Element(this, tag);
  }
  createTextNode(text: string) {
    const node = this.createElement("text");
    node.textContent = text;
    return node;
  }
}
afterEach(() => vi.unstubAllGlobals());
describe("browser developer panel", () => {
  it("derives selectable stages from the built catalogue and invalidates presses across modals", () => {
    expect(developerStages().flatMap((zone) => zone.stages.map((stage) => stage.id))).toEqual(
      ZONE_MAP.destinations.flatMap((zone) => zone.stages),
    );
    let blocked = false;
    const gate = panelInputGate(() => blocked);
    gate.press();
    expect(gate.accepts()).toBe(true);
    blocked = true;
    gate.invalidate();
    blocked = false;
    expect(gate.accepts()).toBe(false);
    gate.press();
    expect(gate.accepts()).toBe(true);
  });
  it("starts collapsed under a Dev link, preserves controls on hide and disables them under modals", () => {
    vi.stubGlobal(
      "MutationObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const document = new FakeDocument();
    const body = document.createElement("body"),
      game = document.createElement("game");
    body.append(game);
    let blocked = false,
      sync: () => void = () => undefined;
    const dispose = mountDeveloperPanel(
      {
        blocked: () => blocked,
        subscribe: (refresh) => {
          sync = refresh;
          return () => undefined;
        },
      },
      game as unknown as HTMLElement,
    );
    const section = body.children[0]!.children[1]!;
    const [toggle, fields] = section.children;
    expect(toggle!.textContent).toBe(DEV_TEXT.toggle);
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    expect(fields!.hidden).toBe(true);
    const click = () => {
      section.dispatchEvent(new Event("pointerdown"));
      toggle!.dispatchEvent(new Event("click"));
    };
    click();
    expect(fields!.hidden).toBe(false);
    const checkbox = fields!.children.at(-1)!.children[1]!;
    checkbox.checked = true;
    click();
    click();
    expect(checkbox.checked).toBe(true);
    const escape = new Event("keydown", { cancelable: true });
    Object.defineProperty(escape, "key", { value: "Escape" });
    section.dispatchEvent(escape);
    expect(fields!.hidden).toBe(true);
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    expect(escape.defaultPrevented).toBe(true);
    expect(checkbox.checked).toBe(true);
    blocked = true;
    sync();
    expect(toggle!.disabled).toBe(true);
    expect(fields!.disabled).toBe(true);
    const text = (node: Element): string =>
      [node.textContent, ...node.children.map(text)].join(" ");
    expect(text(section)).toContain(DEV_TEXT.load);
    expect(text(section)).toContain(DEV_TEXT.invulnerable);
    expect(text(section)).not.toMatch(/\b(version|build|hash)\b/i);
    dispose();
    expect(body.children).toEqual([game]);
  });
});
