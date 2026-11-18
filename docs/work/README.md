# Work items

Each approved task is one file, `docs/work/<id>.md`. It records scope and milestones; live
progress (claims, blocks, receipts and acceptance) stays in the work protocol state root. The
[design index](../design/README.md) lists the work items of each area.

| Front matter | Content                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| `id`         | `cwh-` and a zero-padded sequence (`cwh-0001`), allocated in chronological order. |
| `title`      | A short imperative title.                                                         |
| `status`     | `approved`, `done`, `cancelled` or `superseded`.                                  |
| `approved`   | A short approval reference, such as `user, 2026-11-18`.                           |
| `design`     | The design area in `docs/design/`.                                                |
| `related`    | A list of related work IDs.                                                       |
| `supersedes` | The ID of the item this one replaces; omitted otherwise.                          |

The sections are Scope, Criteria, Decisions and Outcome. Decisions and Outcome state what was
decided or delivered, and why, in a line or two each.

- Only `main` edits design index tables and approved scope. Approval commits the work-file stub
  and its index row on `main`, and that commit allocates the ID.
- Workers edit only their own work file and the design prose that ships with their feature.
  Integration sets `status: done` in the merge.
- A changed or reverted decision is a new work item with `supersedes`. A finished item's outcome
  is never rewritten.
- Work files are public: no session IDs, hostnames, local home-directory paths or quoted
  conversation, only short approval references.
- A backfilled item whose user approval date was inferred from handoff history reads
  `user, <date> (inferred from handoff history)`. One with no traceable approval reads
  `unrecorded (<role>-shipped, <date>)`, dated by its first implementing commit.
- Docs-only changes run only the attribution and lint checks ([cwh-0026](cwh-0026.md)).
- The game never serves or deploys `docs/`: the build reads `pages/` and `public/`, and
  deployment uploads only `dist/`.

## Index

| ID       | Title                                                                                         | Link                       |
| -------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| cwh-0001 | Serve the site as static pages with per-page security headers                                 | [cwh-0001.md](cwh-0001.md) |
| cwh-0002 | Show the shared crash screen on an uncaught error                                             | [cwh-0002.md](cwh-0002.md) |
| cwh-0003 | Play offline from a per-build service worker cache                                            | [cwh-0003.md](cwh-0003.md) |
| cwh-0004 | Offer updates and require one for a newer save                                                | [cwh-0004.md](cwh-0004.md) |
| cwh-0005 | Install the game as a full-screen landscape app                                               | [cwh-0005.md](cwh-0005.md) |
| cwh-0006 | Bundle a reduced WebGL-only Phaser build                                                      | [cwh-0006.md](cwh-0006.md) |
| cwh-0007 | Pack art into content-hashed lossless WebP atlas pages                                        | [cwh-0007.md](cwh-0007.md) |
| cwh-0008 | Turn the page frame to landscape on portrait touch screens                                    | [cwh-0008.md](cwh-0008.md) |
| cwh-0009 | Isolate modal input and dim frozen backdrops through game-kit                                 | [cwh-0009.md](cwh-0009.md) |
| cwh-0010 | Add browser developer controls with run-only cheats                                           | [cwh-0010.md](cwh-0010.md) |
| cwh-0011 | Consume the shared kits as pinned published releases                                          | [cwh-0011.md](cwh-0011.md) |
| cwh-0012 | Run checks in isolated, load-admitted containers                                              | [cwh-0012.md](cwh-0012.md) |
| cwh-0013 | Run boss behaviour as perceive, decide and act                                                | [cwh-0013.md](cwh-0013.md) |
| cwh-0014 | Layer the source into components behind a Phaser boundary                                     | [cwh-0014.md](cwh-0014.md) |
| cwh-0015 | Ship local main through delivery-kit departures                                               | [cwh-0015.md](cwh-0015.md) |
| cwh-0016 | Move the interface to an HTML UI layer                                                        | [cwh-0016.md](cwh-0016.md) |
| cwh-0017 | Show the loading strip only for awaited loads                                                 | [cwh-0017.md](cwh-0017.md) |
| cwh-0018 | Retry a failed first offline installation through the shared Retry                            | [cwh-0018.md](cwh-0018.md) |
| cwh-0019 | Dim and isolate covered modal chrome under strict top-dialog isolation                        | [cwh-0019.md](cwh-0019.md) |
| cwh-0020 | Route discrete actions through the shared hold binding                                        | [cwh-0020.md](cwh-0020.md) |
| cwh-0021 | Pin delivery-kit 4.6.1                                                                        | [cwh-0021.md](cwh-0021.md) |
| cwh-0022 | Set discrete control holds to 500 ms                                                          | [cwh-0022.md](cwh-0022.md) |
| cwh-0023 | Draw the loading failure Retry on the primary plate                                           | [cwh-0023.md](cwh-0023.md) |
| cwh-0024 | Size modal cards by width family                                                              | [cwh-0024.md](cwh-0024.md) |
| cwh-0025 | Accept the 0.56.1 build in the browser after deployment                                       | [cwh-0025.md](cwh-0025.md) |
| cwh-0026 | Run only lint and attribution checks for docs-only changes                                    | [cwh-0026.md](cwh-0026.md) |
| cwh-0027 | Adopt design and work files                                                                   | [cwh-0027.md](cwh-0027.md) |
| cwh-0028 | Write the pitch, setting and story                                                            | [cwh-0028.md](cwh-0028.md) |
| cwh-0029 | Tune Chibi's movement to the grid reaches                                                     | [cwh-0029.md](cwh-0029.md) |
| cwh-0030 | Set the touch, keyboard and mouse controls                                                    | [cwh-0030.md](cwh-0030.md) |
| cwh-0031 | Present conversations in a top dialogue box                                                   | [cwh-0031.md](cwh-0031.md) |
| cwh-0032 | Add the start screen, pause card and settings card                                            | [cwh-0032.md](cwh-0032.md) |
| cwh-0033 | Put optional rooms behind doors                                                               | [cwh-0033.md](cwh-0033.md) |
| cwh-0034 | Assemble stages from seeded hand-designed chunks                                              | [cwh-0034.md](cwh-0034.md) |
| cwh-0035 | Travel a linear map of zones with saved progress                                              | [cwh-0035.md](cwh-0035.md) |
| cwh-0036 | Mark lethal surfaces with red edges                                                           | [cwh-0036.md](cwh-0036.md) |
| cwh-0037 | Build the V1 route from the parcel depot through the five outdoor zones                       | [cwh-0037.md](cwh-0037.md) |
| cwh-0038 | Show the death sequence and retry card                                                        | [cwh-0038.md](cwh-0038.md) |
| cwh-0039 | Name the game and its cast                                                                    | [cwh-0039.md](cwh-0039.md) |
| cwh-0040 | Give each antagonist tells, a special and persistent pursuit                                  | [cwh-0040.md](cwh-0040.md) |
| cwh-0041 | Track runs, attempts and stage statistics                                                     | [cwh-0041.md](cwh-0041.md) |
| cwh-0042 | Write zone introductions, outgoing exchanges and barks                                        | [cwh-0042.md](cwh-0042.md) |
| cwh-0043 | Vary required challenges under stage design principles                                        | [cwh-0043.md](cwh-0043.md) |
| cwh-0044 | Build Apartment as six upward floors                                                          | [cwh-0044.md](cwh-0044.md) |
| cwh-0045 | Play a storybook opening before new games                                                     | [cwh-0045.md](cwh-0045.md) |
| cwh-0046 | Add Dash, Double jump and Speedy as gifted skills                                             | [cwh-0046.md](cwh-0046.md) |
| cwh-0047 | Add transfer gates, warned vents and crumbling supports                                       | [cwh-0047.md](cwh-0047.md) |
| cwh-0048 | Defer Pebble's targeted attacks during forced transit                                         | [cwh-0048.md](cwh-0048.md) |
| cwh-0049 | Add the 26 achievements                                                                       | [cwh-0049.md](cwh-0049.md) |
| cwh-0050 | Make bosses an annoyance, not a fight                                                         | [cwh-0050.md](cwh-0050.md) |
| cwh-0051 | Give each zone a signature obstacle                                                           | [cwh-0051.md](cwh-0051.md) |
| cwh-0052 | Hold one designed arena per encounter stage                                                   | [cwh-0052.md](cwh-0052.md) |
| cwh-0053 | Add Reduced motion and offer Install in every browser                                         | [cwh-0053.md](cwh-0053.md) |
| cwh-0054 | Add the Accessible interface rule                                                             | [cwh-0054.md](cwh-0054.md) |
| cwh-0055 | Keep the HUD visible through dialogue and dim it where inert                                  | [cwh-0055.md](cwh-0055.md) |
| cwh-0056 | Place the touch controls at the control insets inside the view                                | [cwh-0056.md](cwh-0056.md) |
| cwh-0057 | Show the touch controls' icons, states and notes in Settings                                  | [cwh-0057.md](cwh-0057.md) |
| cwh-0058 | Show stage progress horizontally and keep zone visit stats hidden                             | [cwh-0058.md](cwh-0058.md) |
| cwh-0059 | Describe the opening as shipped and settle Fert's wording                                     | [cwh-0059.md](cwh-0059.md) |
| cwh-0060 | Grant skills unselected and tip the player to enable them                                     | [cwh-0060.md](cwh-0060.md) |
| cwh-0061 | Give Restart a close X and focus the primary action first                                     | [cwh-0061.md](cwh-0061.md) |
| cwh-0062 | Re-offer a waiting update on every start-screen arrival                                       | [cwh-0062.md](cwh-0062.md) |
| cwh-0063 | Move the remaining screens to the HTML UI                                                     | [cwh-0063.md](cwh-0063.md) |
| cwh-0064 | Target 125 distinct layouts per zone                                                          | [cwh-0064.md](cwh-0064.md) |
| cwh-0065 | Admit ordinary-qualified layouts for Industrial, Countryside and Woodland                     | [cwh-0065.md](cwh-0065.md) |
| cwh-0066 | Open Pause or Menu from one shared entry                                                      | [cwh-0066.md](cwh-0066.md) |
| cwh-0067 | Place the primary action last in action rows                                                  | [cwh-0067.md](cwh-0067.md) |
| cwh-0068 | Divide stage statistics from the Stage, Zone and Run totals                                   | [cwh-0068.md](cwh-0068.md) |
| cwh-0069 | Prefix the touch settings rows with Display                                                   | [cwh-0069.md](cwh-0069.md) |
| cwh-0070 | Auto-select the first gifted skill                                                            | [cwh-0070.md](cwh-0070.md) |
| cwh-0071 | Keep the opening at four still shots                                                          | [cwh-0071.md](cwh-0071.md) |
| cwh-0072 | Aim for at least 16 ordinary layouts in every zone                                            | [cwh-0072.md](cwh-0072.md) |
| cwh-0073 | Qualify more Blue city layouts                                                                | [cwh-0073.md](cwh-0073.md) |
| cwh-0074 | Finish only the started Blue and Woodland layout work                                         | [cwh-0074.md](cwh-0074.md) |
| cwh-0075 | Write the art plan: process, pipeline, style, animation and lighting                          | [cwh-0075.md](cwh-0075.md) |
| cwh-0076 | Add the shared pixel-art module, palette and animation playback data                          | [cwh-0076.md](cwh-0076.md) |
| cwh-0077 | Add the first UI art and fonts: dialogue, choices, quip, touch and settings                   | [cwh-0077.md](cwh-0077.md) |
| cwh-0078 | Draw the duck protagonist sprite and portrait                                                 | [cwh-0078.md](cwh-0078.md) |
| cwh-0079 | Draw the ferret antagonist sprite and portrait                                                | [cwh-0079.md](cwh-0079.md) |
| cwh-0080 | Add the favicon and app icons on a sunburst disc                                              | [cwh-0080.md](cwh-0080.md) |
| cwh-0081 | Draw round Use and Jump touch buttons and the pause button                                    | [cwh-0081.md](cwh-0081.md) |
| cwh-0082 | Move the UI layout to the 720x360 base resolution                                             | [cwh-0082.md](cwh-0082.md) |
| cwh-0083 | Draw Floor 1's street and lobby tilesets and backdrops                                        | [cwh-0083.md](cwh-0083.md) |
| cwh-0084 | Add the first hazards: cellar hatch, frog courier and snap trap                               | [cwh-0084.md](cwh-0084.md) |
| cwh-0085 | Add the street cast: pigeon, pug and two pedestrians                                          | [cwh-0085.md](cwh-0085.md) |
| cwh-0086 | Add the logo and the icon-only nav logo                                                       | [cwh-0086.md](cwh-0086.md) |
| cwh-0087 | Add the settings and install steps cards                                                      | [cwh-0087.md](cwh-0087.md) |
| cwh-0088 | Add street climbing pieces and fire-escape ladders                                            | [cwh-0088.md](cwh-0088.md) |
| cwh-0089 | Draw the map screen as a paper map                                                            | [cwh-0089.md](cwh-0089.md) |
| cwh-0090 | Add the start screen art: nav bar, icon buttons and Start                                     | [cwh-0090.md](cwh-0090.md) |
| cwh-0091 | Redraw the pedestrian raccoon after a knitted raccoon                                         | [cwh-0091.md](cwh-0091.md) |
| cwh-0092 | Add the autumn park chunk theme                                                               | [cwh-0092.md](cwh-0092.md) |
| cwh-0093 | Add the environment aesthetic rules every theme follows                                       | [cwh-0093.md](cwh-0093.md) |
| cwh-0094 | Place the touch controls and define their press areas                                         | [cwh-0094.md](cwh-0094.md) |
| cwh-0095 | Add the move hint and split the touch controls setting                                        | [cwh-0095.md](cwh-0095.md) |
| cwh-0096 | Clear a zone at its right edge, with doorways leading only to rooms                           | [cwh-0096.md](cwh-0096.md) |
| cwh-0097 | Restyle Zone 1's street as a pale steel morning downtown                                      | [cwh-0097.md](cwh-0097.md) |
| cwh-0098 | Document the map-first flow and the Restart card                                              | [cwh-0098.md](cwh-0098.md) |
| cwh-0099 | Rename the pause card's Return home row to Back to title                                      | [cwh-0099.md](cwh-0099.md) |
| cwh-0100 | Add the locked zone marker and remove the fork choice art                                     | [cwh-0100.md](cwh-0100.md) |
| cwh-0101 | Restyle cards, buttons and switches in pale steel                                             | [cwh-0101.md](cwh-0101.md) |
| cwh-0102 | Add reusable platform terrain and directional red hazard strips                               | [cwh-0102.md](cwh-0102.md) |
| cwh-0103 | Separate street atmosphere into reusable city layers                                          | [cwh-0103.md](cwh-0103.md) |
| cwh-0104 | Define shared form control styles and spacing                                                 | [cwh-0104.md](cwh-0104.md) |
| cwh-0105 | Draw the modular parcel depot and opened parcel                                               | [cwh-0105.md](cwh-0105.md) |
| cwh-0106 | Standardize the start-screen and map action buttons                                           | [cwh-0106.md](cwh-0106.md) |
| cwh-0107 | Add the floppy-eared dog antagonist                                                           | [cwh-0107.md](cwh-0107.md) |
| cwh-0108 | Add the seated failure poses and the retry visual contract                                    | [cwh-0108.md](cwh-0108.md) |
| cwh-0109 | Draw the six-destination route overview and zone primaries                                    | [cwh-0109.md](cwh-0109.md) |
| cwh-0110 | Document the City boundary and stage interface contracts                                      | [cwh-0110.md](cwh-0110.md) |
| cwh-0111 | Define enemy foreground animals and remove the legacy preview cast                            | [cwh-0111.md](cwh-0111.md) |
| cwh-0112 | Document randomized middles for every stage                                                   | [cwh-0112.md](cwh-0112.md) |
| cwh-0113 | Align the art review and asset handoff guidance                                               | [cwh-0113.md](cwh-0113.md) |
| cwh-0114 | Fit modal frames to content with a centred title and top-right close                          | [cwh-0114.md](cwh-0114.md) |
| cwh-0115 | Document the compact update notice modal                                                      | [cwh-0115.md](cwh-0115.md) |
| cwh-0116 | Set the modal minimum width to half the logical viewport                                      | [cwh-0116.md](cwh-0116.md) |
| cwh-0117 | Define canonical modal dimming and input isolation                                            | [cwh-0117.md](cwh-0117.md) |
| cwh-0118 | Lay out the retry card metrics and stage summary columns                                      | [cwh-0118.md](cwh-0118.md) |
| cwh-0119 | Refresh the logos and app icons in muted blue                                                 | [cwh-0119.md](cwh-0119.md) |
| cwh-0120 | Define reusable skins for every stage element                                                 | [cwh-0120.md](cwh-0120.md) |
| cwh-0121 | Draw reusable environment skins for the five later zones                                      | [cwh-0121.md](cwh-0121.md) |
| cwh-0122 | Draw the zone antagonists: raccoon, goose, owl, rabbit and compact ferret                     | [cwh-0122.md](cwh-0122.md) |
| cwh-0123 | Draw the neutral stage cutscene and transition artwork                                        | [cwh-0123.md](cwh-0123.md) |
| cwh-0124 | Add enemy frustration cycles                                                                  | [cwh-0124.md](cwh-0124.md) |
| cwh-0125 | Rename the protagonist to the bird and set the Chibi's Way Home identity                      | [cwh-0125.md](cwh-0125.md) |
| cwh-0126 | Draw Pebble the pigeon boss: flight, swoops and white-block projectile                        | [cwh-0126.md](cwh-0126.md) |
| cwh-0127 | Draw Bini the bear boss: phone poses, portrait and growl wave                                 | [cwh-0127.md](cwh-0127.md) |
| cwh-0128 | Draw Trixi's glasses gesture and arming floor traps                                           | [cwh-0128.md](cwh-0128.md) |
| cwh-0129 | Draw Kiwi's grounded walk and charge cycles                                                   | [cwh-0129.md](cwh-0129.md) |
| cwh-0130 | Draw Furt's parcel throw and marked projectile                                                | [cwh-0130.md](cwh-0130.md) |
| cwh-0131 | Adapt the Archie identity to the dog antagonist with a leaping pounce                         | [cwh-0131.md](cwh-0131.md) |
| cwh-0132 | Unify tonal scenery edges and keep complete building walls                                    | [cwh-0132.md](cwh-0132.md) |
| cwh-0133 | Export per-frame antagonist contact silhouettes                                               | [cwh-0133.md](cwh-0133.md) |
| cwh-0134 | Export stage previews and align the stage interface guides                                    | [cwh-0134.md](cwh-0134.md) |
| cwh-0135 | Balance the stacked logo lettering above the start actions                                    | [cwh-0135.md](cwh-0135.md) |
| cwh-0136 | Correct five source-backed art documentation claims                                           | [cwh-0136.md](cwh-0136.md) |
| cwh-0137 | Draw four-pixel solid red surface hazard panels                                               | [cwh-0137.md](cwh-0137.md) |
| cwh-0138 | Define disabled control feedback, stage images included                                       | [cwh-0138.md](cwh-0138.md) |
| cwh-0139 | Naturalize background trees and fill dense depth layers                                       | [cwh-0139.md](cwh-0139.md) |
| cwh-0140 | Run two quality passes over character, animation, UI and icon art                             | [cwh-0140.md](cwh-0140.md) |
| cwh-0141 | Give the Penthouse preview final-stage treatment across six Apartment floors                  | [cwh-0141.md](cwh-0141.md) |
| cwh-0142 | Build the layered storybook opening art                                                       | [cwh-0142.md](cwh-0142.md) |
| cwh-0143 | Define the homepage art layout and action hierarchy                                           | [cwh-0143.md](cwh-0143.md) |
| cwh-0144 | Delegate the Python art mechanisms to the installed art-kit                                   | [cwh-0144.md](cwh-0144.md) |
| cwh-0145 | Add Pebble, Trixi and Kiwi dialogue portraits                                                 | [cwh-0145.md](cwh-0145.md) |
| cwh-0146 | Document the camera-first bottom-centred death presentation                                   | [cwh-0146.md](cwh-0146.md) |
| cwh-0147 | Offer updates only on Start with explicit cancellation                                        | [cwh-0147.md](cwh-0147.md) |
| cwh-0148 | Add a dedicated spacing and layout guide                                                      | [cwh-0148.md](cwh-0148.md) |
| cwh-0149 | Document naturalistic quadruped silhouette anatomy                                            | [cwh-0149.md](cwh-0149.md) |
| cwh-0150 | Add a readable light play mark for primary actions                                            | [cwh-0150.md](cwh-0150.md) |
| cwh-0151 | Draw the planted large deer and swallow at three times Chibi's size                           | [cwh-0151.md](cwh-0151.md) |
| cwh-0152 | Draw the skill HUD rings, ready faces and icons                                               | [cwh-0152.md](cwh-0152.md) |
| cwh-0153 | Lift Chibi's wings and draw a three-line dash trail and icon                                  | [cwh-0153.md](cwh-0153.md) |
| cwh-0154 | Add the second-jump wing flutter and caret cue                                                | [cwh-0154.md](cwh-0154.md) |
| cwh-0155 | Separate the retry statistics into parallel columns with Attempts last                        | [cwh-0155.md](cwh-0155.md) |
| cwh-0156 | Redesign room doors at Chibi scale                                                            | [cwh-0156.md](cwh-0156.md) |
| cwh-0157 | Add flat disabled button frames and measured label ink alignment                              | [cwh-0157.md](cwh-0157.md) |
| cwh-0158 | Centre the preview-first stage summary                                                        | [cwh-0158.md](cwh-0158.md) |
| cwh-0159 | Order background layers through small tonal depth steps                                       | [cwh-0159.md](cwh-0159.md) |
| cwh-0160 | Add once-played boss lift anticipation poses                                                  | [cwh-0160.md](cwh-0160.md) |
| cwh-0161 | Redraw Bini as a dark grounded quadruped bear                                                 | [cwh-0161.md](cwh-0161.md) |
| cwh-0162 | Straighten the dog's legs and attach its hind legs at the rump                                | [cwh-0162.md](cwh-0162.md) |
| cwh-0163 | Document the installed-app header actions and Start Exit visibility                           | [cwh-0163.md](cwh-0163.md) |
| cwh-0164 | Draw the minimal low-skyline start background                                                 | [cwh-0164.md](cwh-0164.md) |
| cwh-0165 | Add the room entrance building facades                                                        | [cwh-0165.md](cwh-0165.md) |
| cwh-0166 | Document the bottom stage-progress strip                                                      | [cwh-0166.md](cwh-0166.md) |
| cwh-0167 | Separate art pipeline navigation from the visual style guide                                  | [cwh-0167.md](cwh-0167.md) |
| cwh-0168 | Set the game type in Liberation Sans with a typography scale                                  | [cwh-0168.md](cwh-0168.md) |
| cwh-0169 | Smooth the live touch chrome and fill the help illustrations                                  | [cwh-0169.md](cwh-0169.md) |
| cwh-0170 | Mute the warning red and thin the enemy warning                                               | [cwh-0170.md](cwh-0170.md) |
| cwh-0171 | Document the compact summary heading and full-width Pause actions                             | [cwh-0171.md](cwh-0171.md) |
| cwh-0172 | Derive perceptual background ranks and muted zone fauna colours                               | [cwh-0172.md](cwh-0172.md) |
| cwh-0173 | Add intact and warning crumbling-ledge tiles                                                  | [cwh-0173.md](cwh-0173.md) |
| cwh-0174 | Port the art generators from Python to TypeScript                                             | [cwh-0174.md](cwh-0174.md) |
| cwh-0175 | Document the isolated art check container                                                     | [cwh-0175.md](cwh-0175.md) |
| cwh-0176 | Add a looping skid tag to Trixi's goose                                                       | [cwh-0176.md](cwh-0176.md) |
| cwh-0177 | Draw the 26 achievement icons and trophy                                                      | [cwh-0177.md](cwh-0177.md) |
| cwh-0178 | Remove dead art tool code and unused assets                                                   | [cwh-0178.md](cwh-0178.md) |
| cwh-0179 | Type-check and lint the art tools and fix their exit codes                                    | [cwh-0179.md](cwh-0179.md) |
| cwh-0180 | Write sprite sheets with art-kit's native writer                                              | [cwh-0180.md](cwh-0180.md) |
| cwh-0181 | Draw the boss removal puff                                                                    | [cwh-0181.md](cwh-0181.md) |
| cwh-0182 | Rebuild all art from one ordered build runner with a hash check                               | [cwh-0182.md](cwh-0182.md) |
| cwh-0183 | Remove the opening pack, quip strip and stage cutscene placeholder                            | [cwh-0183.md](cwh-0183.md) |
| cwh-0184 | Drop the unused dim2 table and whole-run font sample                                          | [cwh-0184.md](cwh-0184.md) |
| cwh-0185 | Redraw the opened parcel as a plum-outlined cardboard box                                     | [cwh-0185.md](cwh-0185.md) |
| cwh-0186 | Guard font coverage with art-kit's rasteriser                                                 | [cwh-0186.md](cwh-0186.md) |
| cwh-0187 | Write tilesets as indexed PNGs                                                                | [cwh-0187.md](cwh-0187.md) |
| cwh-0188 | Make the bark box more transparent at 0.65 alpha                                              | [cwh-0188.md](cwh-0188.md) |
| cwh-0189 | Remove the unplaced characters and street pieces                                              | [cwh-0189.md](cwh-0189.md) |
| cwh-0190 | Draw the crosswalk signal, awning ledge and gantry crane obstacles                            | [cwh-0190.md](cwh-0190.md) |
| cwh-0191 | Draw the woodland gust, windmill and chandelier obstacles                                     | [cwh-0191.md](cwh-0191.md) |
| cwh-0192 | Set modal titles to the main heading with a balanced title gap                                | [cwh-0192.md](cwh-0192.md) |
| cwh-0193 | Size card-text action illustrations to one body line                                          | [cwh-0193.md](cwh-0193.md) |
| cwh-0194 | Share the translucent dialogue panel across dialogue, barks, gifts and notices                | [cwh-0194.md](cwh-0194.md) |
| cwh-0195 | Add bottom and slab tiles to every terrain look                                               | [cwh-0195.md](cwh-0195.md) |
| cwh-0196 | Fill out the goose head around Trixi's glasses                                                | [cwh-0196.md](cwh-0196.md) |
| cwh-0197 | Verify the favicon is built and set on the website                                            | [cwh-0197.md](cwh-0197.md) |
| cwh-0198 | Set the dialogue panel to 0.60 alpha                                                          | [cwh-0198.md](cwh-0198.md) |
| cwh-0199 | Render the touch chrome, Pause and skill buttons sharp at screen resolution                   | [cwh-0199.md](cwh-0199.md) |
| cwh-0200 | Describe the one-paragraph install steps and their glyphs                                     | [cwh-0200.md](cwh-0200.md) |
| cwh-0201 | Rest the move hint 12px from the view's left and bottom                                       | [cwh-0201.md](cwh-0201.md) |
| cwh-0202 | Place Jump and the move hint 24px from the sides and 20px up                                  | [cwh-0202.md](cwh-0202.md) |
| cwh-0203 | Anchor every control to the game view                                                         | [cwh-0203.md](cwh-0203.md) |
| cwh-0204 | Place the touch controls 40px from the sides and 30px up                                      | [cwh-0204.md](cwh-0204.md) |
| cwh-0205 | Redraw the seven speaker portraits at 48x48                                                   | [cwh-0205.md](cwh-0205.md) |
| cwh-0206 | Redraw the compact dialogue box at 480x60 with a 52x52 portrait frame                         | [cwh-0206.md](cwh-0206.md) |
| cwh-0207 | Point the layout value links at the layout data file                                          | [cwh-0207.md](cwh-0207.md) |
| cwh-0208 | Document device-pixel rendering                                                               | [cwh-0208.md](cwh-0208.md) |
| cwh-0209 | Place Pause and the skill discs 12px from the top corners                                     | [cwh-0209.md](cwh-0209.md) |
| cwh-0210 | Draw the Reduced motion icon and Settings row                                                 | [cwh-0210.md](cwh-0210.md) |
| cwh-0211 | Document the HTML UI cards for stages 1 to 3                                                  | [cwh-0211.md](cwh-0211.md) |
| cwh-0212 | Use the disabled face for locked stages                                                       | [cwh-0212.md](cwh-0212.md) |
| cwh-0213 | Space buttons 16px side by side, 8px stacked and 24px when small                              | [cwh-0213.md](cwh-0213.md) |
| cwh-0214 | Show the loading bar only for loads the player waits for                                      | [cwh-0214.md](cwh-0214.md) |
| cwh-0215 | Place the touch controls 32px from the view's outer and bottom edges                          | [cwh-0215.md](cwh-0215.md) |
| cwh-0216 | Show the live control drawings and touch note in the Settings rows                            | [cwh-0216.md](cwh-0216.md) |
| cwh-0217 | Place the move hint and Jump 40px from the view's edges                                       | [cwh-0217.md](cwh-0217.md) |
| cwh-0218 | Document the dialogue family's HTML panels for stage 4                                        | [cwh-0218.md](cwh-0218.md) |
| cwh-0219 | Place the move hint and Jump from the page's edges, held 8px inside the view                  | [cwh-0219.md](cwh-0219.md) |
| cwh-0220 | Dim the inert skill HUD and hide the conversation under a choice                              | [cwh-0220.md](cwh-0220.md) |
| cwh-0221 | Call Fert he in the art docs and generators                                                   | [cwh-0221.md](cwh-0221.md) |
| cwh-0222 | Place the move hint and Jump 60px from the page's sides                                       | [cwh-0222.md](cwh-0222.md) |
| cwh-0223 | Document that skill grants never select their skill                                           | [cwh-0223.md](cwh-0223.md) |
| cwh-0224 | Draw the 32x32 skill tip glyph                                                                | [cwh-0224.md](cwh-0224.md) |
| cwh-0225 | Add the Restart close X and primary-first focus order                                         | [cwh-0225.md](cwh-0225.md) |
| cwh-0226 | Document HTML scene interfaces and canvas artwork boundaries for stage 5                      | [cwh-0226.md](cwh-0226.md) |
| cwh-0227 | Parse background colours with art-kit's rgb                                                   | [cwh-0227.md](cwh-0227.md) |
| cwh-0228 | Document SVG touch controls and HTML stage progress for stage 6                               | [cwh-0228.md](cwh-0228.md) |
| cwh-0229 | Retire the served bitmap fonts and keep private preview inputs for stage 7                    | [cwh-0229.md](cwh-0229.md) |
| cwh-0230 | Centre a sole visible footer action                                                           | [cwh-0230.md](cwh-0230.md) |
| cwh-0231 | Derive the art grid and room openings from canonical data                                     | [cwh-0231.md](cwh-0231.md) |
| cwh-0232 | Mock the in-game Pause and Start Menu modals                                                  | [cwh-0232.md](cwh-0232.md) |
| cwh-0233 | Generate the hamburger Menu control from canonical glyph geometry                             | [cwh-0233.md](cwh-0233.md) |
| cwh-0234 | Draw UI discs with art-kit's shared ellipse                                                   | [cwh-0234.md](cwh-0234.md) |
| cwh-0235 | Read preview bitmap fonts with art-kit's reader                                               | [cwh-0235.md](cwh-0235.md) |
| cwh-0236 | Align the crash-page font inventory with the Liberation faces                                 | [cwh-0236.md](cwh-0236.md) |
| cwh-0237 | Generate the full Liberation Sans WOFF2 faces                                                 | [cwh-0237.md](cwh-0237.md) |
| cwh-0238 | Import art-kit through its canonical build namespace                                          | [cwh-0238.md](cwh-0238.md) |
| cwh-0239 | Document the first-gift selection, centred gift and Achievements before Settings              | [cwh-0239.md](cwh-0239.md) |
| cwh-0240 | Document the cream, plum and green loading-failure Retry                                      | [cwh-0240.md](cwh-0240.md) |
| cwh-0241 | Finish the one-stage preview capture tool                                                     | [cwh-0241.md](cwh-0241.md) |
| cwh-0242 | Name the Settings rows Display joystick and Display Jump and Use buttons                      | [cwh-0242.md](cwh-0242.md) |
| cwh-0243 | Keep the covered interface painted and dimmed under every modal                               | [cwh-0243.md](cwh-0243.md) |
| cwh-0244 | Keep the loading bar painted and dimmed under modals                                          | [cwh-0244.md](cwh-0244.md) |
| cwh-0245 | Give the loading-failure Retry the primary plate                                              | [cwh-0245.md](cwh-0245.md) |
| cwh-0246 | Set the skill details hold to 500 ms                                                          | [cwh-0246.md](cwh-0246.md) |
| cwh-0247 | Size modals by width family with Large cards at 688                                           | [cwh-0247.md](cwh-0247.md) |
| cwh-0248 | Describe the current stage picker in the map generator comment                                | [cwh-0248.md](cwh-0248.md) |
| cwh-0249 | Align the Settings row notes, heights and state words with source                             | [cwh-0249.md](cwh-0249.md) |
| cwh-0250 | Grant every skill unselected, including the first gift                                        | [cwh-0250.md](cwh-0250.md) |
| cwh-0251 | Add the Tip speaker and first-time tips                                                       | [cwh-0251.md](cwh-0251.md) |
| cwh-0252 | Turn the selected power-up off with a tap                                                     | [cwh-0252.md](cwh-0252.md) |
| cwh-0253 | Author and qualify Blue city layouts toward 16                                                | [cwh-0253.md](cwh-0253.md) |
| cwh-0254 | Release landed and superseded Tech worktrees and branches                                     | [cwh-0254.md](cwh-0254.md) |
| cwh-0255 | Name the opening and start screens and the game page from the text data                       | [cwh-0255.md](cwh-0255.md) |
| cwh-0256 | Adopt the shared Pause and Menu navigation                                                    | [cwh-0256.md](cwh-0256.md) |
| cwh-0257 | Stop shipping the unreferenced Liberation TTFs                                                | [cwh-0257.md](cwh-0257.md) |
| cwh-0258 | Subset the WOFF2 faces to the player-string glyphs with a coverage check                      | [cwh-0258.md](cwh-0258.md) |
| cwh-0259 | Keep non-player copies out of the deployed build                                              | [cwh-0259.md](cwh-0259.md) |
| cwh-0260 | Strip verification hashes from the runtime layouts and ship the palette and art manifest once | [cwh-0260.md](cwh-0260.md) |
| cwh-0261 | Document the boss special moves in a catalogue table                                          | [cwh-0261.md](cwh-0261.md) |
| cwh-0262 | Declare every art build set's outputs so the check catches stale files                        | [cwh-0262.md](cwh-0262.md) |
| cwh-0263 | Gate boss charges by reach and room to move                                                   | [cwh-0263.md](cwh-0263.md) |
| cwh-0264 | Move developer controls into a Settings Cheats modal                                          | [cwh-0264.md](cwh-0264.md) |
