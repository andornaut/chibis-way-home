import { createChromeSvg } from "@andornaut/game-kit/runtime/web/ui/dom/vectorChrome";

export function createCloseGlyph(document: Document): SVGSVGElement {
  const glyph = createChromeSvg(document, { height: 24, width: 24 }, []);
  glyph.classList.add("ui-close-glyph");
  glyph.innerHTML =
    '<path d="M7 7 17 17 M17 7 7 17" fill="none" stroke-linecap="round" stroke-width="2"/>';
  return glyph;
}

// The knob uses the same ring, core and lower-right shade in both positions.
function switchKnob(x: number): string {
  return `<g transform="translate(${x} 8)">
    <circle class="switch-edge" r="6"/>
    <circle class="switch-knob" r="5"/>
    <path class="switch-knob-shade" d="M-3.4 3.1A4.6 4.6 0 0 0 4.6 0"/>
  </g>`;
}

export function createSwitchGlyph(document: Document): SVGSVGElement {
  const glyph = createChromeSvg(document, { height: 16, width: 32 }, []);
  glyph.classList.add("ui-switch-glyph");
  glyph.innerHTML = `
    <rect class="switch-edge" width="32" height="16" rx="8"/>
    <rect class="switch-track" x="1" y="1" width="30" height="14" rx="7"/>
    <path class="switch-track-shade" d="M4 2.9Q6 1.5 8 1.5H24Q26 1.5 28 2.9"/>
    <g data-switch-state="off">
      ${switchKnob(8.5)}
      <path class="switch-mark" d="M19.8 5.8 23.2 9.6 M23.2 5.8 19.8 9.6"/>
    </g>
    <g data-switch-state="on">
      ${switchKnob(23.5)}
      <path class="switch-mark" d="M4.8 8.5 6.5 10.1 11.2 5.8"/>
    </g>`;
  return glyph;
}
