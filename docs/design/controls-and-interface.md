# Controls and interface

The game plays in landscape at 720 by 360, phone browser first: a drag from where a touch lands off
any button moves Chibi, Use and Jump sit under the right thumb, and keyboard keys and mouse holds
cover desktop ([screen and controls](../../gameplay/design.md#screen-and-controls)).
Every discrete tap or click action also fires once on a 500 ms hold, action rows place the primary
action last, and every control has a screen-reader name and keyboard focus rules
([interface](../../gameplay/design.md#interface)). The start screen offers Start or Continue,
Restart behind a confirmation card, Exit where it works, and a waiting update on every start-screen
arrival ([start screen](../../gameplay/design.md#start-screen)). One shared entry opens Pause over
pausable content and Menu elsewhere, with Settings and Achievements nested inside
([settings](../../gameplay/design.md#settings)). Every modal card takes the smallest of the Large,
Medium and Small width families that fits, centres in the view and dims its background; only the top
modal takes input, and covered controls stay painted, dimmed and inactive
([settings](../../gameplay/design.md#settings)).

Reference: [screen and controls](../../gameplay/design.md#screen-and-controls),
[interface](../../gameplay/design.md#interface), [screens and UI](../../src/README.md#screens-and-ui),
[controls](../../art/controls.md), [layout](../../art/layout.md).

## Work items

| ID       | Title                                                                   | Link                               |
| -------- | ----------------------------------------------------------------------- | ---------------------------------- |
| cwh-0008 | Turn the page frame to landscape on portrait touch screens              | [cwh-0008.md](../work/cwh-0008.md) |
| cwh-0009 | Isolate modal input and dim frozen backdrops through game-kit           | [cwh-0009.md](../work/cwh-0009.md) |
| cwh-0016 | Move the interface to an HTML UI layer                                  | [cwh-0016.md](../work/cwh-0016.md) |
| cwh-0019 | Dim and isolate covered modal chrome under strict top-dialog isolation  | [cwh-0019.md](../work/cwh-0019.md) |
| cwh-0020 | Route discrete actions through the shared hold binding                  | [cwh-0020.md](../work/cwh-0020.md) |
| cwh-0022 | Set discrete control holds to 500 ms                                    | [cwh-0022.md](../work/cwh-0022.md) |
| cwh-0023 | Draw the loading failure Retry on the primary plate                     | [cwh-0023.md](../work/cwh-0023.md) |
| cwh-0024 | Size modal cards by width family                                        | [cwh-0024.md](../work/cwh-0024.md) |
| cwh-0025 | Accept the 0.56.1 build in the browser after deployment                 | [cwh-0025.md](../work/cwh-0025.md) |
| cwh-0030 | Set the touch, keyboard and mouse controls                              | [cwh-0030.md](../work/cwh-0030.md) |
| cwh-0032 | Add the start screen, pause card and settings card                      | [cwh-0032.md](../work/cwh-0032.md) |
| cwh-0053 | Add Reduced motion and offer Install in every browser                   | [cwh-0053.md](../work/cwh-0053.md) |
| cwh-0054 | Add the Accessible interface rule                                       | [cwh-0054.md](../work/cwh-0054.md) |
| cwh-0055 | Keep the HUD visible through dialogue and dim it where inert            | [cwh-0055.md](../work/cwh-0055.md) |
| cwh-0056 | Place the touch controls at the control insets inside the view          | [cwh-0056.md](../work/cwh-0056.md) |
| cwh-0057 | Show the touch controls' icons, states and notes in Settings            | [cwh-0057.md](../work/cwh-0057.md) |
| cwh-0061 | Give Restart a close X and focus the primary action first               | [cwh-0061.md](../work/cwh-0061.md) |
| cwh-0062 | Re-offer a waiting update on every start-screen arrival                 | [cwh-0062.md](../work/cwh-0062.md) |
| cwh-0063 | Move the remaining screens to the HTML UI                               | [cwh-0063.md](../work/cwh-0063.md) |
| cwh-0066 | Open Pause or Menu from one shared entry                                | [cwh-0066.md](../work/cwh-0066.md) |
| cwh-0067 | Place the primary action last in action rows                            | [cwh-0067.md](../work/cwh-0067.md) |
| cwh-0069 | Prefix the touch settings rows with Display                             | [cwh-0069.md](../work/cwh-0069.md) |
| cwh-0255 | Name the opening and start screens and the game page from the text data | [cwh-0255.md](../work/cwh-0255.md) |
| cwh-0256 | Adopt the shared Pause and Menu navigation                              | [cwh-0256.md](../work/cwh-0256.md) |
| cwh-0264 | Move developer controls into a Settings Cheats modal                    | [cwh-0264.md](../work/cwh-0264.md) |
