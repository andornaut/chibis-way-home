# Game Design

The premise, cast and authored story of Chibi’s Way Home. The [gameplay index](README.md) links to the current rules, tuning targets and open decisions.

## Pitch

After an argument, Fert mails his sleeping former best friend Chibi far from the apartment they shared. Chibi knows Fert is responsible and journeys home through six zones. V1 follows one linear route with no combat. Completing it does not declare a release.

## Setting

- **Characters:** Chibi is the male bird the player controls: a small, round, cream bird with tiny wings and feet, an orange bill and a dot eye. His full design is in the [art style guide](../art/style-guide.md#chibi). Animals talk; there are no humans
- **Fert:** Chibi's male former best friend and apartment-mate: a champagne (cream-coloured) ferret, about twice Chibi's height, standing upright, with a tall plum stovepipe hat and a red bow tie. His full design is in the [art style guide](../art/style-guide.md#fert)
- **Story boundaries:** the cause of the argument and the outcome of Chibi and Fert's friendship remain undecided
- **World:** the modern day, mixing fantasy and reality
- **Zones:** each is a themed map destination with indoor, outdoor or hybrid stages. The [V1 route](stages.md#v1-route) lists all twenty-one stages

## Cast

| Name   | Identity                 | Role                            |
| ------ | ------------------------ | ------------------------------- |
| Archie | Dog                      | Blue cityscape antagonist       |
| Bini   | Bear                     | Woodland antagonist             |
| Chibi  | Bird                     | Player character                |
| Fert   | Ferret                   | Apartment building antagonist   |
| Kiwi   | Female raccoon           | Home city antagonist            |
| Pebble | Pigeon                   | Industrial outskirts antagonist |
| Trixi  | Goose with round glasses | Countryside antagonist          |

The named cast uses shared data-driven behaviours.

## Opening story

New game and confirmed Restart show the storybook opening before the map; saved Continue bypasses it. Four manually advanced beats, each one still shot of the characters with its text, show Chibi and Fert's friendship, their argument without explaining its cause, Fert packing the sleeping Chibi into a parcel, then Chibi waking far from home determined to return. The opening does not resolve their friendship.

Text-only Next advances immediately, and the final Next opens the map. Previous sits beside Next when an earlier beat is available and revisits it without completing the opening or recording a new result. Skip sits at the top right and opens the map. Only the visible action buttons respond to taps. Tab and the arrows move focus among the available actions. A fresh Enter or Space with nothing focused presses Next. Back, Esc and P open Pause or Menu according to the story's current pausability, without advancing or skipping it. Completion or Skip marks the opening seen, separately from zone introductions. An interrupted unseen opening restarts at its first beat. Confirmed Restart clears that acknowledgement; cancelling Restart changes nothing. Opening playback and acknowledgement do not count as entering a playable stage.

## Fert

- **Appearances:** Fert enlists his friends as a favour. A friend or group is responsible for a themed zone and appears in person or through dialogue overlays; identities beyond Archie, Pebble, Trixi, Bini and Kiwi are undecided
- **Boss encounters:** see the [encounter rules](bosses.md), including [Fert’s parcel attack](bosses.md#fert-encounter)
- **Ending:** Chibi returns home
- **Journey barks:** Fert has two authored live-bark schedule entries per zone, twelve across the journey, spaced after the zone's introduction, except Apartment's restaurant bark, which plays before Fert's Spa introduction. Fert's journey barks play as his offscreen voice; they do not need a visible Fert. Each is a single nonmodal message with no buttons, shown for the bark duration, triggered by current stage progress. Apartment messages occur on the restaurant and residential floors. Cinematics, modal scenes and active barks defer presentation. Only actual presentation marks a message heard; that state survives retries, area transitions and room visits within the generated run, while fresh stage entry resets it. Retry clears queued but unshown messages without marking them heard, leaving them eligible again when current progress reaches their threshold. Pausing the world freezes the message timer

## Rule references

- **Game rules:** <a name="core-loop"></a> [Core loop](rules.md#core-loop), <a name="rules"></a> [Rules](rules.md#rules), <a name="screen-and-controls"></a> [Screen and controls](rules.md#screen-and-controls), <a name="interface"></a> [Interface](rules.md#interface), <a name="map"></a> [Map](rules.md#map), <a name="runs-and-attempts"></a> [Runs and attempts](rules.md#runs-and-attempts), <a name="stage-statistics-and-interstitials"></a> [Stage statistics and interstitials](rules.md#stage-statistics-and-interstitials), <a name="death-and-retry"></a> [Death and retry](rules.md#death-and-retry), <a name="achievements"></a> [Achievements](rules.md#achievements), <a name="start-screen"></a> [Start screen](rules.md#start-screen), <a name="settings"></a> [Settings](rules.md#settings)
- **Movement and skills:** <a name="grid"></a> [Grid](movement.md#grid), <a name="chibi"></a> [Chibi](movement.md#chibi)
- **Stages and routes:** <a name="stages"></a> [Stages](stages.md#stages), <a name="stage-design-principles"></a> [Stage design principles](stages.md#stage-design-principles), <a name="chunks"></a> [Chunks](stages.md#chunks), <a name="objects"></a> [Objects](stages.md#objects), <a name="v1-route"></a> [V1 route](stages.md#v1-route), <a name="first-stage"></a> [First stage](stages.md#first-stage), <a name="city-boundary"></a> [City boundary](stages.md#city-boundary), <a name="industrial-outskirts"></a> [Industrial outskirts](stages.md#industrial-outskirts), <a name="countryside"></a> [Countryside](stages.md#countryside), <a name="woodland"></a> [Woodland](stages.md#woodland), <a name="home-city"></a> [Home city](stages.md#home-city), <a name="apartment-building"></a> [Apartment building](stages.md#apartment-building), <a name="rooms"></a> [Rooms](stages.md#rooms)
- **Bosses:** <a name="boss-behaviour"></a> [Boss behaviour](bosses.md#boss-behaviour), <a name="boss-encounter-principles"></a> [Boss encounter principles](bosses.md#boss-encounter-principles), <a name="forced-transit"></a> [Forced transit](bosses.md#forced-transit), <a name="archie-introductions-and-encounters"></a> [Archie introductions and encounters](bosses.md#archie-introductions-and-encounters), <a name="pebble-encounter"></a> [Pebble encounter](bosses.md#pebble-encounter), <a name="trixi-encounter"></a> [Trixi encounter](bosses.md#trixi-encounter), <a name="bini-encounter"></a> [Bini encounter](bosses.md#bini-encounter), <a name="kiwi-encounter"></a> [Kiwi encounter](bosses.md#kiwi-encounter)
- **Player copy:** <a name="voice"></a> [Voice](player-copy.md#voice), <a name="dialogue"></a> [Dialogue](player-copy.md#dialogue), <a name="quips"></a> [Quips](player-copy.md#quips)
