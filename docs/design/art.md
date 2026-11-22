# Art

Art owns the art rules, asset specifications and pipeline in [art/](../../art/README.md); assets ship from `public/art/`.

- Game art is pixel art at the 720x360 logical base, sampled nearest at the fit scale times min(DPR, 2); HTML text, SVG chrome and help illustrations render with native antialiasing ([style guide](../../art/style-guide.md#direction)).
- Playable and speaking characters use chibi proportions; background foliage, trees and animals use naturalistic forms and anatomy, with hind legs at the rump ([anatomy](../../art/style-guide.md#naturalistic-animal-anatomy)).
- One house palette, Endesga 32, plus game ramps; each V1 destination has one muted zone primary. Shadows and dims step down ramps, never blend with black, and canonical red marks hazards only ([palette](../../art/style-guide.md#palette)).
- Background layers take computed OKLab depth ranks below the flat zone sky; world fauna uses the zone fauna token at 2:1 against the near layer.
- Raster pixels are fully opaque or fully transparent; characters take outlines two ramp steps darker than their fill, and effects a 1px rim ([outlines](../../art/style-guide.md#outlines)).
- Generators in `art/tools/` use art-kit's public API and run with Node 24.22.2 in an isolated container. Change the generator, never its output; `build.ts --check` must leave a clean rebuild ([pipeline](../../art/README.md#pipeline)).
- UI is HTML over a world-only canvas, set in the Chibi Sans WOFF2 faces, a subset of Liberation Sans. Every region outside the top modal stays painted and dimmed by three palette steps ([modal backdrops](../../art/style-guide.md#modal-backdrops)).
- Modal cards use width families (large 688, medium 500, small 400) held 16px inside the view; height fits content and text never shrinks ([controls](../../art/controls.md#sizing-and-spacing), [layout](../../art/layout.md#modals)).
- Buttons are 48px high with 48x48 minimum targets, 16px apart side by side, 8px in vertical stacks and 24px between small buttons. Primary actions are dslate with white labels.
- Touch controls are SVG at 85% opacity, 60px in from the page's sides and 40px up, held 8px inside the 2:1 view ([touch controls](../../art/style-guide.md#touch-controls)).
- [Inventory](../../art/inventory.md) lists every served asset with its key, size and tags.

Reference: [art](../../art/README.md), [style guide](../../art/style-guide.md), [controls](../../art/controls.md), [layout](../../art/layout.md).

## Work items

| ID       | Title                                                                            | Link                               |
| -------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| cwh-0075 | Write the art plan: process, pipeline, style, animation and lighting             | [cwh-0075.md](../work/cwh-0075.md) |
| cwh-0076 | Add the shared pixel-art module, palette and animation playback data             | [cwh-0076.md](../work/cwh-0076.md) |
| cwh-0077 | Add the first UI art and fonts: dialogue, choices, quip, touch and settings      | [cwh-0077.md](../work/cwh-0077.md) |
| cwh-0078 | Draw the duck protagonist sprite and portrait                                    | [cwh-0078.md](../work/cwh-0078.md) |
| cwh-0079 | Draw the ferret antagonist sprite and portrait                                   | [cwh-0079.md](../work/cwh-0079.md) |
| cwh-0080 | Add the favicon and app icons on a sunburst disc                                 | [cwh-0080.md](../work/cwh-0080.md) |
| cwh-0081 | Draw round Use and Jump touch buttons and the pause button                       | [cwh-0081.md](../work/cwh-0081.md) |
| cwh-0082 | Move the UI layout to the 720x360 base resolution                                | [cwh-0082.md](../work/cwh-0082.md) |
| cwh-0083 | Draw Floor 1's street and lobby tilesets and backdrops                           | [cwh-0083.md](../work/cwh-0083.md) |
| cwh-0084 | Add the first hazards: cellar hatch, frog courier and snap trap                  | [cwh-0084.md](../work/cwh-0084.md) |
| cwh-0085 | Add the street cast: pigeon, pug and two pedestrians                             | [cwh-0085.md](../work/cwh-0085.md) |
| cwh-0086 | Add the logo and the icon-only nav logo                                          | [cwh-0086.md](../work/cwh-0086.md) |
| cwh-0087 | Add the settings and install steps cards                                         | [cwh-0087.md](../work/cwh-0087.md) |
| cwh-0088 | Add street climbing pieces and fire-escape ladders                               | [cwh-0088.md](../work/cwh-0088.md) |
| cwh-0089 | Draw the map screen as a paper map                                               | [cwh-0089.md](../work/cwh-0089.md) |
| cwh-0090 | Add the start screen art: nav bar, icon buttons and Start                        | [cwh-0090.md](../work/cwh-0090.md) |
| cwh-0091 | Redraw the pedestrian raccoon after a knitted raccoon                            | [cwh-0091.md](../work/cwh-0091.md) |
| cwh-0092 | Add the autumn park chunk theme                                                  | [cwh-0092.md](../work/cwh-0092.md) |
| cwh-0093 | Add the environment aesthetic rules every theme follows                          | [cwh-0093.md](../work/cwh-0093.md) |
| cwh-0094 | Place the touch controls and define their press areas                            | [cwh-0094.md](../work/cwh-0094.md) |
| cwh-0095 | Add the move hint and split the touch controls setting                           | [cwh-0095.md](../work/cwh-0095.md) |
| cwh-0096 | Clear a zone at its right edge, with doorways leading only to rooms              | [cwh-0096.md](../work/cwh-0096.md) |
| cwh-0097 | Restyle Zone 1's street as a pale steel morning downtown                         | [cwh-0097.md](../work/cwh-0097.md) |
| cwh-0098 | Document the map-first flow and the Restart card                                 | [cwh-0098.md](../work/cwh-0098.md) |
| cwh-0099 | Rename the pause card's Return home row to Back to title                         | [cwh-0099.md](../work/cwh-0099.md) |
| cwh-0100 | Add the locked zone marker and remove the fork choice art                        | [cwh-0100.md](../work/cwh-0100.md) |
| cwh-0101 | Restyle cards, buttons and switches in pale steel                                | [cwh-0101.md](../work/cwh-0101.md) |
| cwh-0102 | Add reusable platform terrain and directional red hazard strips                  | [cwh-0102.md](../work/cwh-0102.md) |
| cwh-0103 | Separate street atmosphere into reusable city layers                             | [cwh-0103.md](../work/cwh-0103.md) |
| cwh-0104 | Define shared form control styles and spacing                                    | [cwh-0104.md](../work/cwh-0104.md) |
| cwh-0105 | Draw the modular parcel depot and opened parcel                                  | [cwh-0105.md](../work/cwh-0105.md) |
| cwh-0106 | Standardize the start-screen and map action buttons                              | [cwh-0106.md](../work/cwh-0106.md) |
| cwh-0107 | Add the floppy-eared dog antagonist                                              | [cwh-0107.md](../work/cwh-0107.md) |
| cwh-0108 | Add the seated failure poses and the retry visual contract                       | [cwh-0108.md](../work/cwh-0108.md) |
| cwh-0109 | Draw the six-destination route overview and zone primaries                       | [cwh-0109.md](../work/cwh-0109.md) |
| cwh-0110 | Document the City boundary and stage interface contracts                         | [cwh-0110.md](../work/cwh-0110.md) |
| cwh-0111 | Define enemy foreground animals and remove the legacy preview cast               | [cwh-0111.md](../work/cwh-0111.md) |
| cwh-0112 | Document randomized middles for every stage                                      | [cwh-0112.md](../work/cwh-0112.md) |
| cwh-0113 | Align the art review and asset handoff guidance                                  | [cwh-0113.md](../work/cwh-0113.md) |
| cwh-0114 | Fit modal frames to content with a centred title and top-right close             | [cwh-0114.md](../work/cwh-0114.md) |
| cwh-0115 | Document the compact update notice modal                                         | [cwh-0115.md](../work/cwh-0115.md) |
| cwh-0116 | Set the modal minimum width to half the logical viewport                         | [cwh-0116.md](../work/cwh-0116.md) |
| cwh-0117 | Define canonical modal dimming and input isolation                               | [cwh-0117.md](../work/cwh-0117.md) |
| cwh-0118 | Lay out the retry card metrics and stage summary columns                         | [cwh-0118.md](../work/cwh-0118.md) |
| cwh-0119 | Refresh the logos and app icons in muted blue                                    | [cwh-0119.md](../work/cwh-0119.md) |
| cwh-0120 | Define reusable skins for every stage element                                    | [cwh-0120.md](../work/cwh-0120.md) |
| cwh-0121 | Draw reusable environment skins for the five later zones                         | [cwh-0121.md](../work/cwh-0121.md) |
| cwh-0122 | Draw the zone antagonists: raccoon, goose, owl, rabbit and compact ferret        | [cwh-0122.md](../work/cwh-0122.md) |
| cwh-0123 | Draw the neutral stage cutscene and transition artwork                           | [cwh-0123.md](../work/cwh-0123.md) |
| cwh-0124 | Add enemy frustration cycles                                                     | [cwh-0124.md](../work/cwh-0124.md) |
| cwh-0125 | Rename the protagonist to the bird and set the Chibi's Way Home identity         | [cwh-0125.md](../work/cwh-0125.md) |
| cwh-0126 | Draw Pebble the pigeon boss: flight, swoops and white-block projectile           | [cwh-0126.md](../work/cwh-0126.md) |
| cwh-0127 | Draw Bini the bear boss: phone poses, portrait and growl wave                    | [cwh-0127.md](../work/cwh-0127.md) |
| cwh-0128 | Draw Trixi's glasses gesture and arming floor traps                              | [cwh-0128.md](../work/cwh-0128.md) |
| cwh-0129 | Draw Kiwi's grounded walk and charge cycles                                      | [cwh-0129.md](../work/cwh-0129.md) |
| cwh-0130 | Draw Furt's parcel throw and marked projectile                                   | [cwh-0130.md](../work/cwh-0130.md) |
| cwh-0131 | Adapt the Archie identity to the dog antagonist with a leaping pounce            | [cwh-0131.md](../work/cwh-0131.md) |
| cwh-0132 | Unify tonal scenery edges and keep complete building walls                       | [cwh-0132.md](../work/cwh-0132.md) |
| cwh-0133 | Export per-frame antagonist contact silhouettes                                  | [cwh-0133.md](../work/cwh-0133.md) |
| cwh-0134 | Export stage previews and align the stage interface guides                       | [cwh-0134.md](../work/cwh-0134.md) |
| cwh-0135 | Balance the stacked logo lettering above the start actions                       | [cwh-0135.md](../work/cwh-0135.md) |
| cwh-0136 | Correct five source-backed art documentation claims                              | [cwh-0136.md](../work/cwh-0136.md) |
| cwh-0137 | Draw four-pixel solid red surface hazard panels                                  | [cwh-0137.md](../work/cwh-0137.md) |
| cwh-0138 | Define disabled control feedback, stage images included                          | [cwh-0138.md](../work/cwh-0138.md) |
| cwh-0139 | Naturalize background trees and fill dense depth layers                          | [cwh-0139.md](../work/cwh-0139.md) |
| cwh-0140 | Run two quality passes over character, animation, UI and icon art                | [cwh-0140.md](../work/cwh-0140.md) |
| cwh-0141 | Give the Penthouse preview final-stage treatment across six Apartment floors     | [cwh-0141.md](../work/cwh-0141.md) |
| cwh-0142 | Build the layered storybook opening art                                          | [cwh-0142.md](../work/cwh-0142.md) |
| cwh-0143 | Define the homepage art layout and action hierarchy                              | [cwh-0143.md](../work/cwh-0143.md) |
| cwh-0144 | Delegate the Python art mechanisms to the installed art-kit                      | [cwh-0144.md](../work/cwh-0144.md) |
| cwh-0145 | Add Pebble, Trixi and Kiwi dialogue portraits                                    | [cwh-0145.md](../work/cwh-0145.md) |
| cwh-0146 | Document the camera-first bottom-centred death presentation                      | [cwh-0146.md](../work/cwh-0146.md) |
| cwh-0147 | Offer updates only on Start with explicit cancellation                           | [cwh-0147.md](../work/cwh-0147.md) |
| cwh-0148 | Add a dedicated spacing and layout guide                                         | [cwh-0148.md](../work/cwh-0148.md) |
| cwh-0149 | Document naturalistic quadruped silhouette anatomy                               | [cwh-0149.md](../work/cwh-0149.md) |
| cwh-0150 | Add a readable light play mark for primary actions                               | [cwh-0150.md](../work/cwh-0150.md) |
| cwh-0151 | Draw the planted large deer and swallow at three times Chibi's size              | [cwh-0151.md](../work/cwh-0151.md) |
| cwh-0152 | Draw the skill HUD rings, ready faces and icons                                  | [cwh-0152.md](../work/cwh-0152.md) |
| cwh-0153 | Lift Chibi's wings and draw a three-line dash trail and icon                     | [cwh-0153.md](../work/cwh-0153.md) |
| cwh-0154 | Add the second-jump wing flutter and caret cue                                   | [cwh-0154.md](../work/cwh-0154.md) |
| cwh-0155 | Separate the retry statistics into parallel columns with Attempts last           | [cwh-0155.md](../work/cwh-0155.md) |
| cwh-0156 | Redesign room doors at Chibi scale                                               | [cwh-0156.md](../work/cwh-0156.md) |
| cwh-0157 | Add flat disabled button frames and measured label ink alignment                 | [cwh-0157.md](../work/cwh-0157.md) |
| cwh-0158 | Centre the preview-first stage summary                                           | [cwh-0158.md](../work/cwh-0158.md) |
| cwh-0159 | Order background layers through small tonal depth steps                          | [cwh-0159.md](../work/cwh-0159.md) |
| cwh-0160 | Add once-played boss lift anticipation poses                                     | [cwh-0160.md](../work/cwh-0160.md) |
| cwh-0161 | Redraw Bini as a dark grounded quadruped bear                                    | [cwh-0161.md](../work/cwh-0161.md) |
| cwh-0162 | Straighten the dog's legs and attach its hind legs at the rump                   | [cwh-0162.md](../work/cwh-0162.md) |
| cwh-0163 | Document the installed-app header actions and Start Exit visibility              | [cwh-0163.md](../work/cwh-0163.md) |
| cwh-0164 | Draw the minimal low-skyline start background                                    | [cwh-0164.md](../work/cwh-0164.md) |
| cwh-0165 | Add the room entrance building facades                                           | [cwh-0165.md](../work/cwh-0165.md) |
| cwh-0166 | Document the bottom stage-progress strip                                         | [cwh-0166.md](../work/cwh-0166.md) |
| cwh-0167 | Separate art pipeline navigation from the visual style guide                     | [cwh-0167.md](../work/cwh-0167.md) |
| cwh-0168 | Set the game type in Liberation Sans with a typography scale                     | [cwh-0168.md](../work/cwh-0168.md) |
| cwh-0169 | Smooth the live touch chrome and fill the help illustrations                     | [cwh-0169.md](../work/cwh-0169.md) |
| cwh-0170 | Mute the warning red and thin the enemy warning                                  | [cwh-0170.md](../work/cwh-0170.md) |
| cwh-0171 | Document the compact summary heading and full-width Pause actions                | [cwh-0171.md](../work/cwh-0171.md) |
| cwh-0172 | Derive perceptual background ranks and muted zone fauna colours                  | [cwh-0172.md](../work/cwh-0172.md) |
| cwh-0173 | Add intact and warning crumbling-ledge tiles                                     | [cwh-0173.md](../work/cwh-0173.md) |
| cwh-0174 | Port the art generators from Python to TypeScript                                | [cwh-0174.md](../work/cwh-0174.md) |
| cwh-0175 | Document the isolated art check container                                        | [cwh-0175.md](../work/cwh-0175.md) |
| cwh-0176 | Add a looping skid tag to Trixi's goose                                          | [cwh-0176.md](../work/cwh-0176.md) |
| cwh-0177 | Draw the 26 achievement icons and trophy                                         | [cwh-0177.md](../work/cwh-0177.md) |
| cwh-0178 | Remove dead art tool code and unused assets                                      | [cwh-0178.md](../work/cwh-0178.md) |
| cwh-0179 | Type-check and lint the art tools and fix their exit codes                       | [cwh-0179.md](../work/cwh-0179.md) |
| cwh-0180 | Write sprite sheets with art-kit's native writer                                 | [cwh-0180.md](../work/cwh-0180.md) |
| cwh-0181 | Draw the boss removal puff                                                       | [cwh-0181.md](../work/cwh-0181.md) |
| cwh-0182 | Rebuild all art from one ordered build runner with a hash check                  | [cwh-0182.md](../work/cwh-0182.md) |
| cwh-0183 | Remove the opening pack, quip strip and stage cutscene placeholder               | [cwh-0183.md](../work/cwh-0183.md) |
| cwh-0184 | Drop the unused dim2 table and whole-run font sample                             | [cwh-0184.md](../work/cwh-0184.md) |
| cwh-0185 | Redraw the opened parcel as a plum-outlined cardboard box                        | [cwh-0185.md](../work/cwh-0185.md) |
| cwh-0186 | Guard font coverage with art-kit's rasteriser                                    | [cwh-0186.md](../work/cwh-0186.md) |
| cwh-0187 | Write tilesets as indexed PNGs                                                   | [cwh-0187.md](../work/cwh-0187.md) |
| cwh-0188 | Make the bark box more transparent at 0.65 alpha                                 | [cwh-0188.md](../work/cwh-0188.md) |
| cwh-0189 | Remove the unplaced characters and street pieces                                 | [cwh-0189.md](../work/cwh-0189.md) |
| cwh-0190 | Draw the crosswalk signal, awning ledge and gantry crane obstacles               | [cwh-0190.md](../work/cwh-0190.md) |
| cwh-0191 | Draw the woodland gust, windmill and chandelier obstacles                        | [cwh-0191.md](../work/cwh-0191.md) |
| cwh-0192 | Set modal titles to the main heading with a balanced title gap                   | [cwh-0192.md](../work/cwh-0192.md) |
| cwh-0193 | Size card-text action illustrations to one body line                             | [cwh-0193.md](../work/cwh-0193.md) |
| cwh-0194 | Share the translucent dialogue panel across dialogue, barks, gifts and notices   | [cwh-0194.md](../work/cwh-0194.md) |
| cwh-0195 | Add bottom and slab tiles to every terrain look                                  | [cwh-0195.md](../work/cwh-0195.md) |
| cwh-0196 | Fill out the goose head around Trixi's glasses                                   | [cwh-0196.md](../work/cwh-0196.md) |
| cwh-0197 | Verify the favicon is built and set on the website                               | [cwh-0197.md](../work/cwh-0197.md) |
| cwh-0198 | Set the dialogue panel to 0.60 alpha                                             | [cwh-0198.md](../work/cwh-0198.md) |
| cwh-0199 | Render the touch chrome, Pause and skill buttons sharp at screen resolution      | [cwh-0199.md](../work/cwh-0199.md) |
| cwh-0200 | Describe the one-paragraph install steps and their glyphs                        | [cwh-0200.md](../work/cwh-0200.md) |
| cwh-0201 | Rest the move hint 12px from the view's left and bottom                          | [cwh-0201.md](../work/cwh-0201.md) |
| cwh-0202 | Place Jump and the move hint 24px from the sides and 20px up                     | [cwh-0202.md](../work/cwh-0202.md) |
| cwh-0203 | Anchor every control to the game view                                            | [cwh-0203.md](../work/cwh-0203.md) |
| cwh-0204 | Place the touch controls 40px from the sides and 30px up                         | [cwh-0204.md](../work/cwh-0204.md) |
| cwh-0205 | Redraw the seven speaker portraits at 48x48                                      | [cwh-0205.md](../work/cwh-0205.md) |
| cwh-0206 | Redraw the compact dialogue box at 480x60 with a 52x52 portrait frame            | [cwh-0206.md](../work/cwh-0206.md) |
| cwh-0207 | Point the layout value links at the layout data file                             | [cwh-0207.md](../work/cwh-0207.md) |
| cwh-0208 | Document device-pixel rendering                                                  | [cwh-0208.md](../work/cwh-0208.md) |
| cwh-0209 | Place Pause and the skill discs 12px from the top corners                        | [cwh-0209.md](../work/cwh-0209.md) |
| cwh-0210 | Draw the Reduced motion icon and Settings row                                    | [cwh-0210.md](../work/cwh-0210.md) |
| cwh-0211 | Document the HTML UI cards for stages 1 to 3                                     | [cwh-0211.md](../work/cwh-0211.md) |
| cwh-0212 | Use the disabled face for locked stages                                          | [cwh-0212.md](../work/cwh-0212.md) |
| cwh-0213 | Space buttons 16px side by side, 8px stacked and 24px when small                 | [cwh-0213.md](../work/cwh-0213.md) |
| cwh-0214 | Show the loading bar only for loads the player waits for                         | [cwh-0214.md](../work/cwh-0214.md) |
| cwh-0215 | Place the touch controls 32px from the view's outer and bottom edges             | [cwh-0215.md](../work/cwh-0215.md) |
| cwh-0216 | Show the live control drawings and touch note in the Settings rows               | [cwh-0216.md](../work/cwh-0216.md) |
| cwh-0217 | Place the move hint and Jump 40px from the view's edges                          | [cwh-0217.md](../work/cwh-0217.md) |
| cwh-0218 | Document the dialogue family's HTML panels for stage 4                           | [cwh-0218.md](../work/cwh-0218.md) |
| cwh-0219 | Place the move hint and Jump from the page's edges, held 8px inside the view     | [cwh-0219.md](../work/cwh-0219.md) |
| cwh-0220 | Dim the inert skill HUD and hide the conversation under a choice                 | [cwh-0220.md](../work/cwh-0220.md) |
| cwh-0221 | Call Fert he in the art docs and generators                                      | [cwh-0221.md](../work/cwh-0221.md) |
| cwh-0222 | Place the move hint and Jump 60px from the page's sides                          | [cwh-0222.md](../work/cwh-0222.md) |
| cwh-0223 | Document that skill grants never select their skill                              | [cwh-0223.md](../work/cwh-0223.md) |
| cwh-0224 | Draw the 32x32 skill tip glyph                                                   | [cwh-0224.md](../work/cwh-0224.md) |
| cwh-0225 | Add the Restart close X and primary-first focus order                            | [cwh-0225.md](../work/cwh-0225.md) |
| cwh-0226 | Document HTML scene interfaces and canvas artwork boundaries for stage 5         | [cwh-0226.md](../work/cwh-0226.md) |
| cwh-0227 | Parse background colours with art-kit's rgb                                      | [cwh-0227.md](../work/cwh-0227.md) |
| cwh-0228 | Document SVG touch controls and HTML stage progress for stage 6                  | [cwh-0228.md](../work/cwh-0228.md) |
| cwh-0229 | Retire the served bitmap fonts and keep private preview inputs for stage 7       | [cwh-0229.md](../work/cwh-0229.md) |
| cwh-0230 | Centre a sole visible footer action                                              | [cwh-0230.md](../work/cwh-0230.md) |
| cwh-0231 | Derive the art grid and room openings from canonical data                        | [cwh-0231.md](../work/cwh-0231.md) |
| cwh-0232 | Mock the in-game Pause and Start Menu modals                                     | [cwh-0232.md](../work/cwh-0232.md) |
| cwh-0233 | Generate the hamburger Menu control from canonical glyph geometry                | [cwh-0233.md](../work/cwh-0233.md) |
| cwh-0234 | Draw UI discs with art-kit's shared ellipse                                      | [cwh-0234.md](../work/cwh-0234.md) |
| cwh-0235 | Read preview bitmap fonts with art-kit's reader                                  | [cwh-0235.md](../work/cwh-0235.md) |
| cwh-0236 | Align the crash-page font inventory with the Liberation faces                    | [cwh-0236.md](../work/cwh-0236.md) |
| cwh-0237 | Generate the full Liberation Sans WOFF2 faces                                    | [cwh-0237.md](../work/cwh-0237.md) |
| cwh-0238 | Import art-kit through its canonical build namespace                             | [cwh-0238.md](../work/cwh-0238.md) |
| cwh-0239 | Document the first-gift selection, centred gift and Achievements before Settings | [cwh-0239.md](../work/cwh-0239.md) |
| cwh-0240 | Document the cream, plum and green loading-failure Retry                         | [cwh-0240.md](../work/cwh-0240.md) |
| cwh-0241 | Finish the one-stage preview capture tool                                        | [cwh-0241.md](../work/cwh-0241.md) |
| cwh-0242 | Name the Settings rows Display joystick and Display Jump and Use buttons         | [cwh-0242.md](../work/cwh-0242.md) |
| cwh-0243 | Keep the covered interface painted and dimmed under every modal                  | [cwh-0243.md](../work/cwh-0243.md) |
| cwh-0244 | Keep the loading bar painted and dimmed under modals                             | [cwh-0244.md](../work/cwh-0244.md) |
| cwh-0245 | Give the loading-failure Retry the primary plate                                 | [cwh-0245.md](../work/cwh-0245.md) |
| cwh-0246 | Set the skill details hold to 500 ms                                             | [cwh-0246.md](../work/cwh-0246.md) |
| cwh-0247 | Size modals by width family with Large cards at 688                              | [cwh-0247.md](../work/cwh-0247.md) |
| cwh-0248 | Describe the current stage picker in the map generator comment                   | [cwh-0248.md](../work/cwh-0248.md) |
| cwh-0249 | Align the Settings row notes, heights and state words with source                | [cwh-0249.md](../work/cwh-0249.md) |
| cwh-0257 | Stop shipping the unreferenced Liberation TTFs                                   | [cwh-0257.md](../work/cwh-0257.md) |
| cwh-0258 | Subset the WOFF2 faces to the player-string glyphs with a coverage check         | [cwh-0258.md](../work/cwh-0258.md) |
| cwh-0262 | Declare every art build set's outputs so the check catches stale files           | [cwh-0262.md](../work/cwh-0262.md) |
| cwh-0265 | Recapture every stage preview from the current game                              | [cwh-0265.md](../work/cwh-0265.md) |
| cwh-0269 | Draw the Industrial underwater window backdrop                                   | [cwh-0269.md](../work/cwh-0269.md) |
| cwh-0271 | Ship fewer and smaller art files                                                 | [cwh-0271.md](../work/cwh-0271.md) |
