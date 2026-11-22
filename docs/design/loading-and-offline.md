# Loading and offline

The shared loader installs and verifies a full build before offline play. Devices that cannot
install can play over the network. A staged build switches silently at launch or through Update
now after play starts and pending saves settle. Dismissing an offer defers it for the session.
A newer save keeps gameplay and writes fenced until a compatible build loads.

Reference: [startup and update rules](../../gameplay/design.md#start-screen), [assets and build](../../src/README.md#assets-and-build),
[phone](../../src/README.md#phone).

## Work items

| ID       | Title                                                              | Link                               |
| -------- | ------------------------------------------------------------------ | ---------------------------------- |
| cwh-0002 | Show the shared crash screen on an uncaught error                  | [cwh-0002.md](../work/cwh-0002.md) |
| cwh-0003 | Play offline from a per-build service worker cache                 | [cwh-0003.md](../work/cwh-0003.md) |
| cwh-0004 | Offer updates and require one for a newer save                     | [cwh-0004.md](../work/cwh-0004.md) |
| cwh-0005 | Install the game as a full-screen landscape app                    | [cwh-0005.md](../work/cwh-0005.md) |
| cwh-0017 | Show the loading strip only for awaited loads                      | [cwh-0017.md](../work/cwh-0017.md) |
| cwh-0018 | Retry a failed first offline installation through the shared Retry | [cwh-0018.md](../work/cwh-0018.md) |
| cwh-0266 | Adopt the game-kit 0.59 install and update loader                  | [cwh-0266.md](../work/cwh-0266.md) |
