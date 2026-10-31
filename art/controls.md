# Form controls

The visual and interaction contract for ordinary buttons and selection controls. All measurements are base pixels in the 720x360 view. See [the art plan](README.md) for the drawing pipeline and [the rulebook](../gameplay/design.md) for game behaviour.

Status means **implemented**, **approved target** (a decision awaiting implementation), or **proposed** (requires a decision). Proposed values are not implementation instructions. This document records the target contract; it does not change runtime controls.

## Scope and exceptions

Apply this guide to menu actions, modal actions and ordinary form controls. A primary action keeps the same colour and geometry wherever it appears; disabled is a state, not another action role.

| Control                | Reason for exception                                     | Retained rules                                                               |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Compact Install action | A 28px action sits within a full-height settings row     | Full 48px row target; compact content padding must still fit the shared font |
| Icon-only navigation   | Compact, recognisable action without a text label        | Consistent icon placement, accessible action name, focus and press area      |
| Movement hint and knob | Continuous directional input rather than a form action   | Contrast and clear state indication                                          |
| Pause, Use and Jump    | In-game controls must remain visible over varied scenery | Contrast, adequate press area and consistent press feedback                  |

Ordinary modal close controls use a 24x24 face exactly 6px from the panel's top and right edges, with their existing 48x48 press target. For panel width W, the face spans (W-30,6) through (W-6,30), while the centred press target spans (W-42,-6) through (W+6,42). Keep the target centred on its face; do not clamp or shift it into the panel. This positioning exception does not apply to bespoke page or top-bar controls. Ordinary body content retains 16px padding.

A new exception names its concrete purpose and retained rules in this table. Placement alone does not justify another button style.

## Design tokens

Palette names refer to [palette.json](../public/art/palette.json). Colours are opaque; disabled controls do not become translucent.

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

Vertical content is centred within the usable face, with the existing two-pixel press displacement. Do not shrink text to meet a size token: grow the button or reword its label. The compact Install exception uses its existing 8px horizontal inset rather than the standard 16px; the whole 48px row remains interactive. Standardizing height does not make every button equally wide; use a shared width within the same action group.

Start-screen Start and Continue use `ui-button-primary`, dslate with white labels, at 192x48. Restart uses `ui-button`, grey with an ink label, also 192x48. With saved progress, Restart is on the left at 164,268 and Continue on the right at 364,268; the row has an 8px gap and is centred under the logo. Continue remains the default action for keyboard activation. Their labels start 13px below the button top and sink 2px while pressed. They use the shared press and focus handling, without a play mark. The map pairs Back to title on the left, secondary grey with an ink label, with Continue on the right, primary dslate with a white label. Back to title is at 164,300,192,48 and Continue at 364,300,192,48, with an 8px gap. Neither uses a play mark. Continue is the first Tab stop and the default Enter or Space action before focus moves; arrows and A/D retain zone selection. The unused `ui-start` remains 192x52 in the asset catalogue. Card actions are 48px high and share the content-fitted width of their action group; Install keeps its compact 72x28 face within a full-height row.

### Modal content fitting

Every ordinary modal sizes its nine-slice frame to its actual content, with 16px clear padding around ordinary body content and a minimum width of 50% of the full logical viewport. The shared tokens are `MODAL_CONTENT = { minWidthFraction: 0.5, padding: 16 }`. For measured content width excluding outer padding, the shared `modalWidth({ availableWidth, viewportWidth }, contentWidth)` rule is `min(availableWidth, max(contentWidth + 32, viewportWidth * 0.5))`. Here `viewportWidth` is the full logical view width, while `availableWidth` is the safe available width after insets. The 720px logical viewport gives a 360px minimum before applying that cap; do not calculate the percentage from the inset-reduced available width. The safe available width is the final cap, not a reason to shrink text. Keep height content-fitted, with no minimum height. These are a width floor and consistent body padding, not a fixed modal canvas. The close face is a positioning exception: it sits exactly 6px from the panel's top and right edges. Measure visible text ink at its existing font size, plus icons, switches, the full positioned close press target and button faces. Include required gaps in the content layout before adding body padding. Do not reserve a fixed canvas size, absent rows or empty footer space. Measure close-target reservations from the panel edge without adding outer padding twice.

- Actions: equal widths within a group, each the widest action label's visible ink plus 16px on each side. Keep the standard 48px height, minimum 12px vertical label inset and 8px horizontal action gap. Stacked actions retain their 4px gap.
- Content: ordinary single-line stat rows use 16px line boxes at the existing 2x font size, with 4px between boxes. The actual glyph ink can be shorter; centre that ink in its line box. Keep an 8px gap between the text block and action row. Paragraphs wrap or grow their box; text never shrinks to fit.
- Headers: centre the title across the complete card. Reserve the entire positioned 48x48 close press target plus an 8px clearance, mirrored on the opposite side to preserve the title's centre. The reservation includes the target's offset relative to the panel, not just the face or target width. The target extends 42px inward from the right edge and down to y42 relative to the panel, so the mirrored horizontal title reservation is 42+8=50px on each side. Keep the complete press rectangle of every interactive body row or action at or below y50 relative to the panel. Account for that control's own expanded target, not only its drawn face: a standard 48px-high action expands by 12px, so its earliest face top is 42+8+12=62px relative to the panel. Derive this from the actual target expansion rather than storing a second placement constant. Noninteractive title text remains in the header. The close face remains 24x24 at the panel's top right, inset exactly 6px from the top and right edges. A required decision without a close control has no reserved close area.
- Placement: ordinary cards centre within the game view. The retry card is top-centred at y16 to leave the seated bird and contact area visible below it. Its content uses the same 16px padding.
- Special-purpose framing: conversation panels retain their portrait-frame borders and paired-speaker layout because those borders frame 64px character artwork. In-game touch controls and the compact Install face retain their documented control exceptions. These do not introduce another ordinary modal padding rule.

Stage selectors use three image-backed cards with fixed image and label positions, full-size 2x main names and a deliberate 1.5x secondary Stage number. Unavailable cards retain greyed scene previews and labels in the disabled palette. See [stage picker geometry](README.md#stage-picker).

### Retry actions

The retry card uses the content-fitted pale steel frame and ordinary secondary and primary action styles. It has no close control. It remains modal until the player chooses an action; outside taps do not dismiss it or activate anything underneath.

Try ordinary placement using the full safe available width first. Only when that placement cannot avoid the visible seated bird body, reserve that body plus an 8px clearance and use the actual body-clear side region as `availableWidth`. The fraction minimum still comes from the full logical viewport; the narrower available region can cap it. For a centred 40x40 visible body in a 720x360 view, either side offers 332px after clearance, so the fallback caps the card at 332px rather than the normal 360px minimum. Keep the 16px content padding, fonts, expanded press targets, camera and bird body unchanged.

| Action        | Role      | Size                   | Label           |
| ------------- | --------- | ---------------------- | --------------- |
| Back to title | Secondary | Equal group width x 48 | Ink on grey     |
| Try again     | Primary   | Equal group width x 48 | White on dslate |

The left-to-right order carries meaning: leaving is secondary, retrying is primary. Derive the shared width from the widest actual label, with an 8px gap between actions. Labels use `font-body` at 2x, centred by visible ink, with the standard pressed displacement and focus ring. Apply the shared expanded press targets and nearest-centre overlap rule. The game supplies every label and value; art does not bake text into the textures. See [the retry layout](README.md#stage-progress-and-retry) for the seven text rows, four run metrics and frozen scene.

### Update notice action

The update notice uses one primary Update now action and the ordinary close X, which defers the update. There is no separate Later action or redundant body copy. Keep the shared 2x fonts, focus ring, pressed feedback and expanded press targets. Only the explicit primary action accepts; tapping the card face does not accept. See [the update notice](README.md#update-notice) for its content-fitted header.

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

A disabled action retains its label and layout but cannot activate. The disabled face is pale steel (`lgrey`, `#c0cbdc`), with dark steel (`dslate`, `#3a4466`) text at 5.83:1 contrast. Primary is dark steel with white text; secondary is grey (`#8b9bb4`) with ink (`#181425`) text. Its flat silhouette distinguishes it from a raised secondary action without relying on colour alone. Ordinary buttons have no approved hover-specific visual treatment; hover must not change their size or role colour.

Dialogue Continue and Skip use the ordinary primary and secondary button styles, respectively, at 192x48 with an 8px gap. Required dialogue choices use ordinary buttons on a modal card rather than the legacy `ui-answer` artwork.

## Labels and icons

- Centre the visible label ink, not its font advance. At 2x, `font-body` visible width is advance minus 2px.
- Centre a leading icon, its gap and the label as one group. Preserve the same horizontal content inset on both sides of that group.
- Keep labels mixed case, short and consistent for the same action. The game supplies words; do not bake text into textures.
- Maintain at least 4.5:1 label contrast and 3:1 for essential marks. Use an icon colour suited to the face, rather than reusing a dark icon on a dark primary button.

The current ink `ui-play-mark` is unsuitable for a dslate face. A light variant or a tintable equivalent is required before restoring that mark on primary actions.

## Selection controls

Checkboxes, radio buttons and switches share this specification structure. Their semantics differ; do not replace one with another solely to reuse available art.

| Control      | Value semantics                                       | States                                                        | Drawn size | Label and placement                                         | Press area         | Keyboard                                          | Status                              |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ------------------ | ------------------------------------------------- | ----------------------------------- |
| Checkbox     | Independent boolean selection, usually part of a form | Unchecked, checked, focused, disabled; mixed only if required | 16x16      | Visible adjacent label; whole labelled row activates        | Shared target rule | Space toggles focused choice                      | Approved target; no current asset   |
| Radio button | Exactly one selection in a named group                | Unselected, selected, focused, disabled                       | 16x16      | Visible adjacent label; whole labelled row activates        | Shared target rule | Arrows move/select within group; Space selects    | Approved target; no current asset   |
| Switch       | Independent boolean setting applied immediately       | Off, on, focused, disabled                                    | 32x16      | Icon, label and switch in the whole content-fitted 48px row | Whole row          | Existing settings focus navigation and activation | On/off implemented; disabled target |

The switch uses knob position and a glyph: right with a tick for on; left with a cross for off. Off is an available value and must never look disabled. Checked and selected likewise remain separate from enabled and disabled.

## Interaction and accessibility

- Activating a disabled control has no effect. Keyboard navigation skips disabled controls; their labels remain visible.
- Focus is independent of pressed, selected and checked. Never remove the shared focus ring because a control is already coloured.
- On existing menus, Tab and arrows move focus; Enter and Space activate the focused action. A held key does not repeatedly activate an action.
- Approved target for paired runtime integration: every actual modal dims its background through the canonical shared-kit backdrop painter and receives input exclusively. There are no Duck modal exceptions. This includes update notices, settings, pause, install, restart, death/retry, stage selection, stage clear, zone clear and modal dialogue or choices. Outside taps follow the modal’s dismissal rule and never activate controls underneath.
- Draw exactly one canonical dim backdrop for the visible modal layer. Death/retry must not combine a pre-dimmed world with a second modal dim. Retain the existing palette treatment, control contrast and modal geometry.
- Live zone foreshadow dialogue is nonmodal: play and its controls remain interactive. Page headers and ordinary page content are not modal overlays.
- Overlapping expanded press areas choose the nearest control centre. Keep drawn faces and labels visually separate even where their press areas meet.
- Selection controls require visible labels; icon-only exceptions require an unambiguous action name. Exposing those names to assistive technology is a runtime requirement, not something a PNG supplies.

## Asset and code contract

| Concern                   | Current contract                                                                       | Intended change or gap                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Button face assets        | `ui-button` and `ui-button-primary`; tags `normal`, `pressed`                          | Shared disabled treatment needs an asset/tag and runtime support                              |
| Checkbox and radio assets | None                                                                                   | Target 16x16 square checkbox and circular radio; check mark or centre dot indicates selection |
| Colour source             | Served palette data                                                                    | Keep control tokens tied to palette names                                                     |
| Focus asset               | `ui-focus`, nine-slice 16x16, margins 4 on all sides                                   | Retain for every ordinary control                                                             |
| Geometry source           | Runtime layout values                                                                  | Add approved shared size/spacing tokens without copying literals between screens              |
| Label rendering           | Runtime `font-body` at 2x                                                              | Light primary icon required                                                                   |
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

Remaining implementation: provide a light primary play mark, add disabled states and supply checkbox/radio assets when implementing forms. The asset and code contract above records these gaps.
