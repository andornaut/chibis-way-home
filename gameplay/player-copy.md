# Player copy

The game’s voice, dialogue, barks and tips. Exact player-facing text is maintained in the data files below.

## Voice

- **Data:** every string a player sees lives in the text data files, with `{placeholders}` the game fills, never as a literal in code
- **Fit:** text never shrinks to fit. Reword it or grow its box
- **Labels:** one label for one action, everywhere. Player instructions name Move, Jump and Use with their matching inline control icons, rather than keyboard mappings; each icon and action label form one unit
- **Lengths:** measure the rendered width in [Chibi Sans](../art/style-guide.md#typography-scale). A dialogue paragraph or bark fits two lines of 408 px. An achievement notice fits one bold title line and one description line
- **Spelling:** Canadian (colour, favourite, neighbour). No em dashes and no emojis
- **Style:** concise exchanges with distinct voices and brief jokes. Chibi stays determined to reclaim his home. Archie is earnest about his territory, Pebble is smug about flying, Trixi invents convenient rules, Bini is a distracted gamer, Kiwi is dry and observant, and Fert is theatrical about his failed delivery. See the [story boundaries](design.md#setting)
- **Terms:** the home page is the website's page at `/`; it is never shown inside an installed app. The start screen is the game's first screen, in a browser and in an installed app. [Back to title](rules.md#settings) uses the same label throughout

## Dialogue

- **Box:** a fixed box along the top, not a speech bubble, for a conversation between two characters, sometimes three. It shows one paragraph at a time, with the current speaker's name tab and, when available, a 48 px portrait inside the panel. A speaker without a portrait shows none. Chibi's portrait is on the left; other speakers' portraits are on the right. Consecutive paragraphs from the same speaker keep the same alignment. Each paragraph has at most 2 lines. A paragraph that runs to a 3rd line is reworded
- **Choices:** a required choice is a card over the conversation carrying its prompt and answers alone: the conversation panel, Continue and Skip hide under it, and the answer ends the conversation
- **Forward:** every multi-exchange conversation pauses gameplay. Continue advances one paragraph, and so does a tap or any other key except P and Esc. Tab and the arrows move focus through Continue then Skip, and Enter or Space press the focused button; modifier keys and held repeats are ignored. Continue and Skip are visible controls. Exchanges never advance on a timer; there is no back or scrolling chat history
- **Introductions:** at the beginning of each zone's explicitly designated introduction stage, the antagonist enters from offscreen on the right and reaches about the midpoint of the current viewport before the paused manual exchange begins. The cinematic sprite is separate from world-stage objects and has no combat collision or attacks. The world and all underlying controls stay paused during its approach and the manually advanced Continue/Skip exchange. Completing or skipping the exchange marks the introduction seen. As soon as the antagonist turns right and starts running away, only the introduction-owned freeze and input cover are released, allowing Chibi to move immediately. Other pause or modal owners still block play. The separate cinematic actor remains noncolliding and outside the encounter quota while it runs offscreen, and is removed offscreen or on scene shutdown. Both approach and departure use its maximum charge or dash speed from shared behaviour data. This cinematic sequence is outside the combat encounter quota; it does not make enemy contact safe during normal play. The first five zones introduce their antagonist in stage one; Apartment introduces Fert in Spa, its fourth floor. Earlier Apartment floors do not mark that introduction seen. The introduction plays once per zone per playthrough. Its seen state is shared across all stages in the zone and survives death, retries and stage replay; a new game resets it
- **Outgoing exchanges:** completing a zone's final stage shows its outgoing exchange over an actual image of the cleared stage's art, with Continue at the bottom right and Skip available. Completing or skipping the exchange proceeds to stage and cumulative zone statistics, then the map walk; Fert's final exchange and statistics proceed to the celebration instead
- **Panel:** every in-game dialogue panel (conversations, barks, the achievement notice and tips) has a translucent background at `DIALOGUE_PANEL_ALPHA` in `src/data/dialogues.ts`; text, portraits and icons stay opaque
- **Skip:** Skip skips the remaining paragraphs, then any required choice shows
- **Tips:** the Tip speaker (`tip` in `src/data/dialogues.ts`: name tab "Tip", a light-bulb portrait on the right) gives short first-time tips (`TEXT.tips` in `src/data/text.ts`) in the shared dialogue panel. A tip is nonmodal: it shows for as long as an unlock notice, in trigger order behind every pending unlock notice, only during uncovered active play, never pauses play and is dismissed by a tap. Each tip shows once per playthrough; its seen state is saved as it starts and confirmed Restart clears it, and a tip triggered but not yet shown triggers again later. Controls shows at the start of a run of the map's first stage; Doors when a room door first comes into view; Hazards when an always-red lethal surface first comes into view, not a warned vent, an active crosswalk or a red projectile; Bosses when a boss first acquires Chibi. Each newly owned skill shows the power-up tip, naming that skill with its glyph, and owning a second skill shows the switch tip. Move, Jump and Use appear with their control icons (Labels)

## Quips

- **Barks:** each of the six antagonists has one live spotting bark and one escape bark (see Enemy pursuit), with no Continue, Skip or other controls. Gameplay continues while one shows for up to `BARK_DURATION_SECONDS` in `src/data/dialogues.ts`. The spotting bark appears once per area, object and attempt. Re-entering an area in the same attempt retains the seen state; retrying clears it. A bark starts only while its actual speaking world actor is rendered on screen in the current area and attempt. If that actor leaves view, dismiss the shown bark without requeuing it; keep unshown queued lines pending until their owner is visible. Pausing the world freezes its timer, and modal cards appear above it. Paused multi-exchange conversations remain manually advanced and untimed
- **Panel taps:** a tap anywhere in a conversation except Skip advances; a tap on a bark, unlock notice or tip dismisses only it, preserving queued and scheduled lines

## Exact copy sources

The [text data](../src/data/text.ts) owns the exact achievement titles and descriptions, dialogue and speaker names, opening lines, barks, menu labels, statistics labels and tips. [Crash text](../src/data/crashText.ts) owns the early crash screen’s wording.

| Where copy appears                       | Reference                                      |
| ---------------------------------------- | ---------------------------------------------- |
| Achievement conditions and notice timing | [achievements.ts](../src/data/achievements.ts) |
| Conversation order and speakers          | [dialogues.ts](../src/data/dialogues.ts)       |
| Mid-stage journey barks                  | [stageBarks.ts](../src/data/stageBarks.ts)     |
| Opening beat order                       | [opening.ts](../src/data/opening.ts)           |
| Retry and stage-clear statements         | [statsBarks.ts](../src/data/statsBarks.ts)     |
