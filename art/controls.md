# Form controls

The visual and interaction contract for ordinary buttons and selection controls. All measurements are base pixels in the 720x360 view. See [the art plan](README.md) for the drawing pipeline and [the rulebook](../gameplay/design.md) for game behaviour.

Status means **implemented**, **approved target** (a decision awaiting implementation), or **proposed** (requires a decision). Proposed values are not implementation instructions. This document records the target contract; it does not change runtime controls.

## Scope and exceptions

Apply this guide to menu actions, modal actions and ordinary form controls. A primary action keeps the same colour and geometry wherever it appears; disabled is a state, not another action role.

| Control                | Reason for exception                                                 | Retained rules                                                               |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Compact Install action | A 28px action sits within a full-height settings row                 | Full 48px row target; compact content padding must still fit the shared font |
| Icon-only navigation   | Compact, recognisable action without a text label                    | Consistent icon placement, accessible action name, focus and press area      |
| Movement hint and knob | Continuous directional input rather than a form action               | Contrast and clear state indication                                          |
| Pause, Use and Jump    | In-game controls must remain visible over varied scenery             | Contrast, adequate press area and consistent press feedback                  |
| Skill HUD icons        | Native 16px glyphs over smooth 35px faces, with a dark selected ring | 48x48 targets; play tap selects, hold opens details; Pause tap opens details |

Ordinary modal close controls use a 24x24 face exactly 6px from the panel's top and right edges, with their existing 48x48 press target. For panel width W, the face spans (W-30,6) through (W-6,30), while the centred press target spans (W-42,-6) through (W+6,42). Keep the target centred on its face; do not clamp or shift it into the panel. This positioning exception does not apply to bespoke page or top-bar controls. Ordinary body content retains 16px padding.

A new exception names its concrete purpose and retained rules in this table. Placement alone does not justify another button style.

## Design tokens

Palette names refer to [palette.json](../public/art/palette.json). Colours are opaque; disabled controls do not become translucent. Procedural skill-button circles use fractional coverage only at their antialiased edges, with opaque interiors and unchanged native glyphs.

| Name            | Value                       | Unit            | Purpose                                    | Status                                                           |
| --------------- | --------------------------- | --------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Card face       | `lgrey`                     | palette colour  | Neutral menu ground                        | Implemented                                                      |
| Disabled face   | `lgrey`                     | palette colour  | Distinct, flat unavailable control         | Approved target                                                  |
| Disabled label  | `dslate`                    | palette colour  | Readable label on disabled face            | Approved target                                                  |
| Focus band      | `yellow`, fringed in `ink`  | palette colours | Keyboard focus independent of role         | Implemented                                                      |
| Label font      | `font-body`, mixed case, 2x | font and scale  | Ordinary control labels                    | Implemented                                                      |
| Primary face    | `dslate`                    | palette colour  | One colour for the main action             | Implemented on cards and start screen; approved target elsewhere |
| Primary label   | `white`                     | palette colour  | Label and essential icon on primary face   | Implemented on cards and start screen; approved target elsewhere |
| Secondary face  | `grey`                      | palette colour  | Other ordinary actions                     | Implemented                                                      |
| Secondary label | `ink`                       | palette colour  | Label and essential icon on secondary face | Implemented                                                      |

## Sizing and spacing

A texture's nine-slice margins preserve its corners and are not content padding. Keep face dimensions, content padding, gaps and expanded press areas separate.

| Name                             | Value                                                              | Unit                        | Purpose                                                                     | Status                                                           |
| -------------------------------- | ------------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Button content inset, horizontal | 16 minimum                                                         | px per side                 | Clear space between visible label/icon group and button edge                | Approved target                                                  |
| Button content inset, vertical   | 12 minimum                                                         | px per side                 | Clear space above and below label ink                                       | Approved target                                                  |
| Button height, standard          | 48                                                                 | px                          | Ordinary menu and modal actions                                             | Implemented on cards and start screen; approved target elsewhere |
| Button width                     | Shared within an action group; grow to fit content                 | rule                        | Like actions have matching sizes                                            | Approved target                                                  |
| Card content padding             | 16                                                                 | px on every side            | Clear space around ordinary body content; close face is exempt              | Approved target                                                  |
| Card minimum width               | 50% of full logical viewport width, capped at safe available width | px                          | Minimum ordinary modal width when the view permits it                       | Approved target                                                  |
| Close face inset                 | 6                                                                  | px from panel top and right | Ordinary modal close placement, excluding bespoke page and top-bar controls | Approved target                                                  |
| Close face size                  | 24x24                                                              | px                          | Preserve existing close artwork                                             | Implemented                                                      |
| Close press target               | 48x48                                                              | px                          | Preserve the target centred on the face                                     | Implemented                                                      |
| Compact action height            | 28                                                                 | px                          | Install's compact action within its full-size row                           | Implemented exception                                            |
| Focus expansion                  | 4                                                                  | px per side                 | Ring outside the focused face                                               | Implemented                                                      |
| Icon-to-label gap                | 6                                                                  | px                          | Leading play mark and label                                                 | Implemented                                                      |
| Control row height               | 48                                                                 | px                          | Full labelled selection row                                                 | Implemented for settings; approved target throughout             |
| Ordinary control gap             | 8                                                                  | px                          | Separate unrelated controls or groups                                       | Approved target                                                  |
| Press displacement               | 2                                                                  | px down                     | Move face, label and icon together                                          | Implemented                                                      |
| Press target                     | 48 minimum                                                         | px per axis                 | Minimum interactive target                                                  | Implemented                                                      |
| Press target growth              | 25% of shorter face side, clamped to 6..16                         | px per side                 | Enlarge the drawn control's press area                                      | Implemented                                                      |
| Stacked action gap               | 4                                                                  | px                          | Consecutive equal-height card actions                                       | Implemented                                                      |

Centre visible label ink horizontally and vertically within each state's visible face, correcting the text origin for the font's ink bearings and kerning. The normal face excludes the four-pixel lower lip; the pressed face has that same height and moves down exactly 2px. The flat disabled face uses the complete drawn button rectangle. A 48px action therefore has a 44px normal face, a 44px pressed face shifted down 2px and a 48px disabled face. Measure these faces separately from the expanded press target and nine-slice margins. For ink bounds relative to the text origin, place that origin at `face.x + floor((face.width - ink.width) / 2) - ink.x` and `face.y + floor((face.height - ink.height) / 2) - ink.y`; leave any indivisible spare pixel after the ink. An optional native 5x10 play mark and label form one horizontally centred group with a 6px gap; centre each vertically within the same face. Keep the existing full-size `font-body` at 2x. Continue's measured text origin is 14px below a standard button's top when normal and 16px when pressed or disabled; these are results of the ink measurement, not shared label-offset constants. Do not shrink text to meet a size token: grow the button or reword its label. The compact Install exception uses its existing 8px horizontal inset rather than the standard 16px; the whole 48px row remains interactive. Standardizing height does not make every button equally wide; use a shared width within the same action group.

Start-screen Start and Continue use `ui-button-primary`, dslate with white labels, at 192x48. Restart uses `ui-button`, grey with an ink label, also 192x48. With saved progress, Restart is on the left at 164,268 and Continue on the right at 364,268; the row has an 8px gap and is centred under the logo. Continue remains the default action for keyboard activation. Their labels use the shared per-state visible-face and ink measurements. They use the shared press and focus handling, without a play mark. The map pairs Back to title on the left, secondary grey with an ink label, with Continue on the right, primary dslate with a white label. Back to title is at 164,300,192,48 and Continue at 364,300,192,48, with an 8px gap. Neither uses a play mark. Continue is the first Tab stop and the default Enter or Space action before focus moves; arrows and A/D retain zone selection. The unused `ui-start` remains 192x52 in the asset catalogue. Card actions are 48px high and share the content-fitted width of their action group; Install keeps its compact 72x28 face within a full-height row.

### Modal content fitting

Every ordinary modal sizes its nine-slice frame to its actual content, with 16px clear padding around ordinary body content and a minimum width of 50% of the full logical viewport. The shared tokens are `MODAL_CONTENT = { minWidthFraction: 0.5, padding: 16 }`. For measured content width excluding outer padding, the shared `modalWidth({ availableWidth, viewportWidth }, contentWidth)` rule is `min(availableWidth, max(contentWidth + 32, viewportWidth * 0.5))`. Here `viewportWidth` is the full logical view width, while `availableWidth` is the safe available width after insets. The 720px logical viewport gives a 360px minimum before applying that cap; do not calculate the percentage from the inset-reduced available width. The safe available width is the final cap, not a reason to shrink text. Keep height content-fitted, with no minimum height. These are a width floor and consistent body padding, not a fixed modal canvas. The close face is a positioning exception: it sits exactly 6px from the panel's top and right edges. Measure visible text ink at its existing font size, plus icons, switches, the full positioned close press target and button faces. Include required gaps in the content layout before adding body padding. Do not reserve a fixed canvas size, absent rows or empty footer space. Measure close-target reservations from the panel edge without adding outer padding twice.

- Actions: equal widths within a group, each the widest action label's visible ink plus 16px on each side. Keep the standard 48px height, minimum 12px vertical label inset and 8px horizontal action gap. Stacked actions retain their 4px gap.
- Content: ordinary single-line stat rows use 16px line boxes at the existing 2x font size, with 4px between boxes. The actual glyph ink can be shorter; centre that ink in its line box. Keep an 8px gap between the text block and action row. Paragraphs wrap or grow their box; text never shrinks to fit.
- Headers: centre the title across the complete card. Reserve the entire positioned 48x48 close press target plus an 8px clearance, mirrored on the opposite side to preserve the title's centre. The reservation includes the target's offset relative to the panel, not just the face or target width. The target extends 42px inward from the right edge and down to y42 relative to the panel, so the mirrored horizontal title reservation is 42+8=50px on each side. Keep the complete press rectangle of every interactive body row or action at or below y50 relative to the panel. Account for that control's own expanded target, not only its drawn face: a standard 48px-high action expands by 12px, so its earliest face top is 42+8+12=62px relative to the panel. Derive this from the actual target expansion rather than storing a second placement constant. Noninteractive title text remains in the header. The close face remains 24x24 at the panel's top right, inset exactly 6px from the top and right edges. A required decision without a close control has no reserved close area.
- Placement: every actual modal centres horizontally and vertically within the full logical game view, including death/retry. Content uses the same 16px padding. Full-page interstitials are not modal cards.
- Special-purpose framing: conversation panels retain their portrait-frame borders and paired-speaker layout because those borders frame 64px character artwork. In-game touch controls and the compact Install face retain their documented control exceptions. These do not introduce another ordinary modal padding rule.

Approved title target for paired runtime integration: centre every actual modal's title across the whole modal, including framed death/retry, long install instructions and stage selection. Reserve the full positioned close press target plus the normal gap symmetrically on both sides, rather than centring the title in the remaining asymmetric space. With a close face 6px from the top-right edge and its centred 48px target, the target extends 42px inward; adding the 8px gap gives 50px title clearance on each side. Without a close control, retain symmetric content padding. Wrap long titles at the existing font size and grow the measured header or modal; never shrink text. This rule does not change full-page headers, the close geometry or the half-viewport width floor.

Stage selectors use three 208x154 image-backed cards within a centred 688x236 panel, with fixed image and label positions, full-size 2x main names and a deliberate 1.5x secondary Stage number. Unavailable cards retain greyed scene previews and labels in the disabled palette. Their title centres vertically within the measured header while retaining whole-panel horizontal centring. Keep exactly 8px between the full close target and stage-row press targets. See [stage picker geometry](README.md#stage-picker).

### Retry actions

The retry card uses the content-fitted pale steel frame and ordinary secondary and primary action styles. It has no close control. It remains modal until the player chooses an action; outside taps do not dismiss it or activate anything underneath.

Measure the death/retry card once at full font size and centre it in the logical viewport. Do not move or narrow it around the bird. Before the first death pose, visibly pan the paused world so the final 48x42 sprite frame is horizontally centred and its bottom reaches y360 in the 720x360 view. Use shared `sineInOut` easing at 360px/s, with duration derived from camera distance and clamped to 0.5 through 2 seconds; exactly zero distance completes immediately. Simulation, input and active-play statistics remain frozen through the pan. Only after it finishes does the one death sequence begin, followed by the modal. Shutdown cancels late pan completion. Preserve authored transparent padding. A void fall starts 96px above the final presentation floor, resolved once at the planned post-recoil position. Only the presentation sprite moves; rules state stays frozen. Keep that camera framing through the one death sequence and modal snapshot, without a second reframe or replay when the modal opens. The world restores original camera scroll and bounds idempotently on retry, title return or shutdown, cancelling contact-feedback offsets first. Physics and retry behaviour remain unchanged.

| Action        | Role      | Size                   | Label           |
| ------------- | --------- | ---------------------- | --------------- |
| Back to title | Secondary | Equal group width x 48 | Ink on grey     |
| Try again     | Primary   | Equal group width x 48 | White on dslate |

The left-to-right order carries meaning: leaving is secondary, retrying is primary. Derive the shared width from the widest actual label, with an 8px gap between actions. Labels use `font-body` at 2x, centred by visible ink, with the standard pressed displacement and focus ring. Apply the shared expanded press targets and nearest-centre overlap rule. The game supplies every label and value; art does not bake text into the textures. See [the retry layout](README.md#stage-progress-and-retry) for the centred identity/progress group, four metrics on shared left-label and right-value axes, and frozen scene. Adjacent identity, optional single-line statement and metrics groups have an 8px gap, with 4px between rows inside each group. The title keeps symmetric 50px clearance without adding a close control. Derive card height from the measured groups, 16px padding and the 48px action row; wrapped content grows it.

### Update notice action

The Start-only update notice places secondary Cancel on the left and primary Update now on the right, with the ordinary close X. Cancel, X, outside taps, Escape and Back defer without reloading or discarding the waiting service worker. Dismissal persists for the same Start visit and resets only when Start is created again, not when it resumes or settings closes. Keep the shared 2x fonts, centred native card, dim backdrop, focus ring, pressed feedback and full press targets. Only Update now accepts; tapping the card face does not accept. See [the update notice](README.md#update-notice) for its content-fitted header.

## Button roles and states

Primary and secondary buttons share one silhouette, cut corners and nine-slice geometry. Role controls colour; interaction state controls geometry and feedback.

| Role/state         | Fill                        | Label/icon | Border and highlight                       | Geometry                               | Status                                                           |
| ------------------ | --------------------------- | ---------- | ------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- |
| Primary, normal    | `dslate`                    | `white`    | No outline; `slate` highlight, `navy` lip  | Raised face                            | Implemented on cards and start screen; approved target elsewhere |
| Primary, pressed   | `dslate`                    | `white`    | Lip disappears                             | Face, label and icon descend 2px       | Implemented on cards and start screen                            |
| Primary, focused   | Normal or pressed primary   | `white`    | Shared yellow focus ring outside face      | Size unchanged                         | Implemented                                                      |
| Secondary, normal  | `grey`                      | `ink`      | No outline; `lgrey` highlight, `slate` lip | Same raised face                       | Implemented                                                      |
| Secondary, pressed | `grey`                      | `ink`      | Lip disappears                             | Same 2px displacement                  | Implemented                                                      |
| Secondary, focused | Normal or pressed secondary | `ink`      | Shared yellow focus ring outside face      | Size unchanged                         | Implemented                                                      |
| Any role, disabled | `lgrey`                     | `dslate`   | Flat face, no outline or raised lip        | Same outer size; no press displacement | Approved target                                                  |

A disabled action retains its label and layout but cannot activate. Approved target for paired runtime integration: a refused activation gives 320ms of feedback without invoking the action. In normal motion, all visible control parts, including a stage card’s screenshot, move horizontally by 3px with a 40ms yoyo repeated three times; labels alternate red and their original colour every 80ms over the same interval. Restore positions and label colours when feedback completes. Reduced motion holds labels steadily red for 320ms with no movement or flashing. Keep the existing disabled palette, focus treatment and keyboard skipping; this feedback does not enable the control. The disabled face is pale steel (`lgrey`, `#c0cbdc`), with dark steel (`dslate`, `#3a4466`) text at 5.83:1 contrast. Primary is dark steel with white text; secondary is grey (`#8b9bb4`) with ink (`#181425`) text. Its flat silhouette distinguishes it from a raised secondary action without relying on colour alone. Ordinary buttons have no approved hover-specific visual treatment; hover must not change their size or role colour.

Dialogue Continue and Skip use the ordinary primary and secondary button styles, respectively, at 192x48 with an 8px gap. Required dialogue choices use ordinary buttons on a modal card rather than the legacy `ui-answer` artwork.

## Labels and icons

- Centre the visible label ink, not its font advance. At 2x, `font-body` visible width is advance minus 2px.
- Centre a leading icon, its gap and the label as one group. Preserve the same horizontal content inset on both sides of that group.
- Keep labels mixed case, short and consistent for the same action. The game supplies words; do not bake text into textures.
- Maintain at least 4.5:1 label contrast and 3:1 for essential marks. Use an icon colour suited to the face, rather than reusing a dark icon on a dark primary button.

`ui-play-mark` retains ink `rest` for pale and legacy green faces and supplies cream `light` for dslate primary faces. Both tags share the same 5x10 triangle and 100ms timing. The primary consumer must select `light`; its contrast on dslate is 6.59:1.

## Selection controls

Checkboxes, radio buttons and switches share this specification structure. Their semantics differ; do not replace one with another solely to reuse available art.

| Control      | Value semantics                                       | States                                                        | Drawn size | Label and placement                                         | Press area         | Keyboard                                          | Status                              |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ------------------ | ------------------------------------------------- | ----------------------------------- |
| Checkbox     | Independent boolean selection, usually part of a form | Unchecked, checked, focused, disabled; mixed only if required | 16x16      | Visible adjacent label; whole labelled row activates        | Shared target rule | Space toggles focused choice                      | Approved target; no current asset   |
| Radio button | Exactly one selection in a named group                | Unselected, selected, focused, disabled                       | 16x16      | Visible adjacent label; whole labelled row activates        | Shared target rule | Arrows move/select within group; Space selects    | Approved target; no current asset   |
| Switch       | Independent boolean setting applied immediately       | Off, on, focused, disabled                                    | 32x16      | Icon, label and switch in the whole content-fitted 48px row | Whole row          | Existing settings focus navigation and activation | On/off implemented; disabled target |

The switch uses knob position and a glyph: right with a tick for on; left with a cross for off. Off is an available value and must never look disabled. Checked and selected likewise remain separate from enabled and disabled.

## Interaction and accessibility

- Activating a disabled control never invokes its action. Its approved refusal feedback includes all visible parts, including screenshot images. Keyboard navigation skips disabled controls; their labels remain visible.
- Focus is independent of pressed, selected and checked. Never remove the shared focus ring because a control is already coloured.
- On existing menus, Tab and arrows move focus; Enter and Space activate the focused action. A held key does not repeatedly activate an action.
- Every actual modal dims its background by three `palette.darker` steps through the canonical shared-kit backdrop painter and receives input exclusively. There are no Chibi modal exceptions. This includes update notices, settings, pause, install, restart, death/retry, stage selection, stage clear, zone clear and modal dialogue or choices. Outside taps follow the modal’s dismissal rule and never activate controls underneath.
- Draw exactly one canonical dim backdrop pass for the visible modal layer. Death/retry uses the normal painter on its ordinary frozen snapshot, without the `alreadyDimmed` bypass. The bypass is identity only for genuinely pre-dimmed images. Do not add an alpha overlay to the remapped image; retain the opaque ink fallback, control contrast and modal geometry. Ambient start-screen dimming remains a separate two-step treatment.
- Live zone foreshadow dialogue is nonmodal: play and its controls remain interactive. Page headers and ordinary page content are not modal overlays.
- Overlapping expanded press areas choose the nearest control centre. Keep drawn faces and labels visually separate even where their press areas meet.
- Selection controls require visible labels; icon-only exceptions require an unambiguous action name. Exposing those names to assistive technology is a runtime requirement, not something a PNG supplies.

Full-page stage-end summaries centre their combined content block while left-aligning every heading, metric label and value to its measured column axis. They reuse the exact selector preview through `STAGE_PREVIEWS[stage]`. This full-page rule does not change actual modal title centring or death/retry layout. See [summary geometry](README.md#stage-and-zone-summaries).

## Asset and code contract

| Concern                   | Current contract                                                                       | Intended change or gap                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Button face assets        | `ui-button` and `ui-button-primary`; tags `normal`, `pressed`, `disabled`              | Flat pale-steel disabled frame supplied; runtime tag selection remains required               |
| Checkbox and radio assets | None                                                                                   | Target 16x16 square checkbox and circular radio; check mark or centre dot indicates selection |
| Colour source             | Served palette data                                                                    | Keep control tokens tied to palette names                                                     |
| Focus asset               | `ui-focus`, nine-slice 16x16, margins 4 on all sides                                   | Retain for every ordinary control                                                             |
| Geometry source           | Runtime layout values                                                                  | Add approved shared size/spacing tokens without copying literals between screens              |
| Label rendering           | Runtime `font-body` at 2x                                                              | Primary icon uses `light` tag                                                                 |
| Nine-slice face           | 16x28, margins left/top/right/bottom 2/4/2/6                                           | Primary, secondary and disabled use the same outer geometry                                   |
| Map actions               | Back to title: shared secondary on the left; Continue: shared primary on the right     | Equal widths, 48px height and an 8px gap                                                      |
| Start-screen actions      | Start/Continue: shared primary; Restart: shared secondary; all 192x48 with 8px row gap | Implemented without play mark; nav icons remain explicit exceptions                           |
| Switch asset              | `ui-switch`, tags `on`, `off`                                                          | Use shared focus ring and disabled tokens; retain knob position and value glyph               |

## Review checklist

1. Compare the control in its real menu or modal, in normal, pressed, focused and disabled states.
2. Check matching face sizes, content insets and gaps across the action group.
3. Verify labels fit at the shared font size, with icons centred as part of the group.
4. Check contrast in colour and greyscale, and check at fractional phone scale.
5. Confirm enabled state, selected value and keyboard focus remain distinguishable.
6. Confirm keyboard and touch activation use the same action and disabled controls cannot activate.
7. Record any exception and its concrete reason rather than introducing an undocumented style.

## Open decisions

None for the standard colours, dimensions, spacing or disabled navigation defined here. New bespoke controls require an explicit exception and a contextual review before implementation.

Remaining implementation: select the light play-mark tag on primary actions, add disabled states and supply checkbox/radio assets when implementing forms. The asset and code contract above records these gaps.
