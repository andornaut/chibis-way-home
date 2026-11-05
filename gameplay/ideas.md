# Ideas

Undecided and cut ideas; nothing here is a commitment.

Format: `- [status] **Idea**: short description · notes`. Statuses: **floated** (said, not discussed), **exploring** (being discussed), **cut** (decided against, kept with the reason so it isn't argued again).

## Story

- [floated] **Humans**: people Chibi meets along the way · focus on animals for now
- [floated] **Owner at home**: his owner waits for him at home, or calls · a possible ending

## Rule proposals

- [exploring] **Calling card**: every trap Fert sets carries a badge of his stovepipe hat and bow tie · Fert sets no traps; his special throws parcels
- [exploring] **Dialogue choices**: a conversation can end in a required choice shown in a modal, and Skip opens that modal without choosing. A choice changes where Chibi goes, what he does and what he sees; V1 has no route forks · the modal exists, but no dialogue has a choice and carried choices set no flags. Effects on later zones or the ending are undecided
- [exploring] **Laundry line ride**: a laundry basket on a pulley line carries Chibi diagonally up between Home city facades, pausing at both docks · second option for Home city after retracting awnings; needs a diagonal mover track and an exit or layout rule for Kiwi drops on a rider
- [exploring] **Lobby escalator**: a looping chain of one-way steps carries Chibi up the Apartment zigzag under red-edged ceiling bands, so he rides without full jumps · second option for Apartment after the swinging chandelier; needs a looping track
- [exploring] **Optional-content loop**: start with one Blue cityscape prototype. Show an optional item from the primary route, with its detour and return route legible; reach it through a short challenge that varies the zone's established traversal; return by a shortcut or enter an adjacent friendly room to redeem it; receive a small optional reward. The stage exit always works without it · a generated detour connects to the actual route with a safe return, and never requires searching a procedural dead end, repeating a cleared stage or backtracking through an antagonist encounter. Friendly room inhabitants are conversational characters, not foreground hostiles. Optional routes may reconnect locally without changing V1's linear zone order. Human playtesting judges whether the detour reads as optional, whether the shortcut prevents tedious repetition and whether the reward is worth the interruption; bot completion does not. Keep the prototype small enough to remove without affecting the primary route
- [exploring] **Optional rewards, ranked**: in recommended order · whether items, redemptions or rewards persist across death, fresh entry or playthroughs is unresolved; no save fields, checkpoint behaviour, shield stacking or reward replenishment are prescribed
  1. **Clue or cosmetic:** a visible route hint or a cosmetic token first. These leave calibrated movement unchanged and test whether exploration is enjoyable
  2. **One-hit shield:** only after that loop works. Consumed immediately on the first otherwise lethal contact hazard; falls remain lethal, and contact protection never becomes blanket immunity to vertical hazards. Activation, remaining contact during consumption and feedback need a separate implementation decision
  3. **Other buffs:** deferred. Extra lives add little with unlimited retries; speed or jump buffs change traversal calibration and can invalidate authored routes
- [exploring] **Parcel cart lane**: an unattended parcel cart rolls back and forth along a Blue cityscape sidewalk with red bumpers; Chibi jumps it with a full jump or waits on an awning above · second option for Blue after the crosswalk signal; the cart must not be an animal
- [exploring] **Pinecone drop**: a shaking Woodland branch drops lethal pinecones straight down in a steady rhythm; Chibi crosses between drops or under cover · second option for Woodland after ravine gusts; undecided whether pinecones affect bosses
- [exploring] **Room shops and quests**: rooms offer items to buy or sell, quests to take, rewards, threats and talk that advances the story, with friendly animals inside · current rooms hold an entry dialogue and a skill gift
- [exploring] **Stamping press**: an Industrial press block drops to the floor and rises with long pauses; its underside is red, its top is a ride, and it shudders before dropping · second option for Industrial after the gantry crane ride
- [exploring] **Waterlogged raft**: a Countryside river raft sinks shortly after Chibi lands and floats back, like a crumbling support · second option for Countryside after windmill sails

## Open questions

These are unresolved, not current implementation requirements.

- **Beginning:** the cause of Chibi and Fert's fight
- **Ending:** the outcome of their friendship when Chibi returns to the shared apartment
- **Friends:** the identities of the friends Fert enlists beyond Archie, Pebble, Trixi, Bini and Kiwi, and their encounters
- **Rooms:** the currency and what items do; what quests and rewards give and how they are tracked; what a threat leads to; whether a room can be revisited, and whether its dialogue changes
- **Use:** what it acts on besides doors (assumed: talking to animals, and objects at route forks)

## Cut

- [cut] **Back button and timed dialogue**: going back a dialogue screen, or advancing on a timer · a tap or keypress moves forward only
- [cut] **Climbing a hotel**: he climbs a hotel floor by floor to get home · he travels zone to zone across a map
- [cut] **Combat**: Chibi attacks or stomps · the challenge is platforming, hazards and choices
- [cut] **Double-tap for a minimal jump**: two quick taps give the smallest hop · it delays every jump and clashes with the jump buffer
- [cut] **Fixed movement control**: a joystick in the lower left whose halves also act as buttons · a touch anywhere sets the neutral point
- [cut] **Flutter on a hold or its own button**: flutter only when chosen · every jump flutters
- [cut] **Historical and futuristic zones**: zones themed on a past or future era · zones are modern-day places
- [cut] **Jump on release**: the jump starts when Jump is released after a hold · it adds delay and breaks coyote time and buffering
