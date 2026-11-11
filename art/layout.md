# Layout guide

The shared structure for Chibi's Way Home spacing and alignment. Values below distinguish verified consumer geometry from approved design targets; they do not assert that every existing page conforms. [Controls](controls.md) owns control states and interaction details; [the style guide](style-guide.md) owns appearance and assets; [Art](README.md) owns the drawing pipeline.

## Coordinates and scale

The game uses a 720x360 logical view, defined in [screen data](../src/data/screen.ts). Measure game layout in logical pixels. Artwork keeps nearest-neighbour sampling; dedicated font textures use their local linear filter without changing shared sprite-atlas filtering. Review native and fractional scales. The in-game HTML UI layer lays out in the same logical pixels: `--ui-unit` is the CSS px per base pixel (the view's fit), and every CSS length is base pixels times `--ui-unit`. Nine-slice margins, focus-ring bands and the pressed label's sink round to whole CSS px. Responsive HTML pages use CSS pixels and safe-area insets instead of inheriting the game's fixed canvas dimensions.

The [typography scale](style-guide.md#typography-scale) owns role sizes, weights, line heights and implementation status. Measure the selected role’s signed glyph ink, kerning and full line boxes separately. Wrap text, grow its measured region or reflow content instead of reducing its font size.

## Spacing tokens

Use a shared token for repeated spacing, rather than unrelated coordinates that happen to match. A named design token is not a claim that every consumer already imports one implementation constant.

| Token             | Value                   | Unit       | Scope                                                             | Status or source                                                                                   |
| ----------------- | ----------------------- | ---------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Row gap           | 4                       | logical px | Related text rows                                                 | Verified `CARD_CONTENT.rowGap`, [UI layout values](../src/data/layout.ts)                          |
| Related-group gap | 8                       | logical px | Heading to metrics, label to value, grouped actions               | Verified `CARD_CONTENT.gap` and `TEXT_BUTTON.gap`                                                  |
| Page inset        | 16                      | logical px | Ordinary full-page content and footer alignment                   | Approved shared layout target; consumers derive their available bounds                             |
| Panel padding     | 16                      | logical px | Ordinary modal bodies                                             | Verified modal `CARD_CONTENT.padding`; retry statistics retain their documented inset              |
| Column gap        | 16 ordinary, 32 summary | logical px | Ordinary columns and paired stage-summary statistics              | [Measured summary layout](style-guide.md#stage-and-zone-summaries)                                 |
| Text line box     | 16 minimum              | logical px | Current native ink-box minimum; role line heights remain separate | `CARD_CONTENT.lineHeight`; [typography scale](style-guide.md#typography-scale) owns displayed text |

## Page bounds/alignment

Derive the available content region and footer from the same page inset. At the standard 16px inset, the 720px game view offers 688px of horizontal content space. Centre the stage summary’s measured content within that region; the Continue face’s right edge uses the same page inset. Derive the available width instead of storing another independent margin.

Respect top dialogue and footer reservations before fitting the remaining content. Full-page interstitials are page layouts, not modal cards. Responsive pages preserve readable text and safe-area padding; reflow or allow their intended scrolling rather than squeezing the game canvas rules into HTML.

## Groups/columns

Use 16px between ordinary columns and inside panels, 8px between related groups or label/value axes, and 4px between metric rows. Share measured header and row heights across adjacent statistic groups. Align headings, labels and values to each group’s explicit axes; retain at least the related-group gap between the widest label and its value. Stage summaries use their measured 32px statistics-column gap.

The [full-page stage summary](style-guide.md#stage-and-zone-summaries) centres its identity and existing stage image above paired statistics columns. Preserve the complete 2:1 image with nearest-neighbour scaling, left-aligned metric labels and right-aligned values. The style guide owns the measured geometry. Death/retry retains its separate compact modal.

## Controls/targets

Drawn faces, content padding, texture nine-slice margins and expanded press targets are distinct measurements. Preserve the complete target when placing adjacent content.

| Token                   | Value       | Unit       | Scope                           | Status or source                                                         |
| ----------------------- | ----------- | ---------- | ------------------------------- | ------------------------------------------------------------------------ |
| Standard action height  | 48          | logical px | Ordinary menu and modal actions | Verified `TEXT_BUTTON`, [UI layout values](../src/data/layout.ts)        |
| Minimum press target    | 48x48       | logical px | Ordinary discrete game controls | Verified `HIT_RULE.minTarget`, [UI layout values](../src/data/layout.ts) |
| Horizontal action inset | 16 per side | logical px | Ordinary action labels          | Verified `TEXT_BUTTON.inset`                                             |
| Settings icon           | 16x16       | logical px | Ordinary settings-row icons     | Verified `SETTINGS_CARD`, [UI layout values](../src/data/layout.ts)      |
| Compact Install face    | 28 high     | logical px | Explicit settings-row exception | Existing exception; retain the whole 48px row target                     |

Centre each button label's actual visible ink within its current drawn face, including its font bearings and kerning, rather than centring its baseline, advance width or press target. The shared `TEXT_BUTTON.lipHeight` ([UI layout values](../src/data/layout.ts)) excludes the 4px lower lip from normal and pressed faces, shifts the pressed face down 2px exactly once and uses the full flat rectangle for disabled faces. Optional marks and labels centre horizontally as one group, with the native 5x10 mark and 6px gap; each centres vertically within that state's face. Label origins derive from these measured bounds, with no fixed vertical label offset. These bitmap-font measurements apply to in-game controls; responsive HTML controls retain their CSS font metrics.

Equalize face widths within an action group using its widest actual label and padding. Keep the normal 8px action gap. Expanded targets may meet; use the existing nearest-centre overlap handling. Navigation icons and continuous touch controls retain their specific geometry.

## Modals

Centre actual modals horizontally and vertically within the logical game viewport, using the shared safe-margin clamp. Measure their contents at full font size. Minimum width is half the **full** logical viewport, expanded for content and capped by safe available width: `min(availableWidth, max(contentWidth + 32, viewportWidth * 0.5))`. Content width excludes outer padding. Height is content-fitted, with no fixed minimum or font reduction.

| Token                     | Value                | Unit       | Scope                      | Status or source                                         |
| ------------------------- | -------------------- | ---------- | -------------------------- | -------------------------------------------------------- |
| Close face                | 24x24                | logical px | Ordinary modal X           | Verified `CARD_CONTENT.closeSize`                        |
| Close inset               | 6 from top and right | logical px | Close face positioning     | Verified `CARD_CONTENT.closeInset`                       |
| Close target              | 48x48                | logical px | Centred on the close face  | Derived through `hitAround`                              |
| Symmetric title clearance | 50 per side          | logical px | Whole-modal title centring | Full positioned target extends 42px inward, plus 8px gap |
| Modal body padding        | 16                   | logical px | Ordinary modal content     | Verified `CARD_CONTENT.padding`                          |

Centre titles across the whole modal and mirror the full close-target reservation on the opposite side. Keep other interactive targets clear of the close target by 8px, accounting for their own expansion. Wrap long titles and grow the measured header. A mandatory modal does not acquire a close control merely to match the frame.

All actual modals retain canonical dimming and exclusive input. Page headers, live nonmodal barks and full-page interstitials retain their own presentation contracts.

## HUD/overlays

Place HUD elements from their own screen and control anchors. The progress line, touch circles, movement hint and pause control are bespoke overlays; their working geometry is not replaced by the ordinary 16px page grid.

The top zone-dialogue panel is 480 wide and centred on the view at 120,76,480,60, with its name tab overhanging to y 66, its portrait regions and its compact 36px footer row at y 140 to 176, as defined in `DIALOGUE_LAYOUT` ([UI layout values](../src/data/layout.ts)). Reserve its actual bounds before arranging content below it. Live barks remain distinct from paused dialogue and modal overlays.

## Exceptions and verification

| Exception                     | Concrete reason                                                                  | Retained rules                                                           | Status or source                                          |
| ----------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Compact Install face          | Embedded in a full-height settings row                                           | Full font, labelled action and 48px row target                           | Existing control exception                                |
| Compact summary heading       | Separate identity rows, complete preview and footer clearance share a fixed page | Uniform compact heading role; full body/action fonts and measured bounds | [Typography exception](style-guide.md#typography-scale)   |
| Dialogue panel                | Fixed portrait and speaker regions and a compact 36px footer row                 | Full fonts, measured text and reserved footer                            | `DIALOGUE_SCREEN`                                         |
| Navigation and touch controls | Icon navigation or continuous directional input                                  | Contrast, target handling and clear state                                | Existing bespoke geometry                                 |
| Responsive homepage           | HTML content reflows outside the game canvas                                     | Safe insets, full fonts and ordinary action sizing                       | Approved homepage contract                                |
| Stage summary                 | Full-page identity, preview and paired statistics                                | Shared page inset, measured columns, existing image and full fonts       | [Summary layout](style-guide.md#stage-and-zone-summaries) |

For a layout change, verify only the affected consumer geometry and content fit. Check native and fractional context, long actual labels, complete press targets and the intended safe bounds. Reuse existing source-owner evidence and library contracts; do not repeat library implementation tests. Record unresolved source integration as pending rather than claiming complete page conformance.
