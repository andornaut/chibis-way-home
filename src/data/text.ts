import type { GameText } from "./types";

export const TEXT: GameText = {
  buttons: {
    jump: "Jump",
    use: "Use",
  },
  celebration: {
    continue: "Continue",
    message: "Replay unlocked stages from the map.",
    restart: "Restart",
    title: "Home at last",
  },
  crash: {
    body: "The game stopped. Reload to play again.",
    reload: "Reload",
    title: "Something went wrong",
  },
  death: {
    progress: "Progress: {percent}%",
    retry: "Try again",
    stage: "Stage {number}: {name}",
    time: "Time: {time}",
    title: "{zone}",
  },
  dialogue: {
    continue: "Continue",
    skip: "Skip",
    speakers: {
      bear: "Bini",
      bird: "Chibi",
      dog: "Archie",
      ferret: "Furt",
      goose: "Trixi",
      pigeon: "Pebble",
      raccoon: "Kiwi",
    },
  },
  homePage: {
    description: "Help Chibi get home after Furt, his former best friend, mails him far away.",
    keyboard: "Keyboard: arrow keys to walk and jump; E to use; P to pause.",
    play: "Play",
    subline: "Jump through city streets, avoid red-edged hazards and get past Archie.",
    touch: "Touch: drag left or right to walk; press {jump} or {use}.",
  },
  lines: {
    "depot-dog-intro-1": "Furt asked me to stop you.",
    "depot-dog-intro-2": "I am going home.",
    "depot-dog-intro-3": "Then you will have to get past me.",
  },
  map: {
    continue: "Continue",
    stages: {
      "city-boundary": "City boundary",
      "city-outskirts": "City outskirts",
      "climb-to-apartment": "Climb to the apartment",
      "entrance-and-lobby": "Entrance and lobby",
      "familiar-neighbourhood": "Familiar neighbourhood",
      farmland: "Farmland",
      "forest-paths": "Forest paths",
      "freight-terminal": "Freight terminal",
      ravine: "Ravine",
      "river-crossing": "River crossing",
      street: "Parcel depot and streets",
      "warehouse-district": "Warehouse district",
    },
    title: "Map",
    zones: {
      apartment: "Apartment building",
      "blue-cityscape": "Blue cityscape",
      countryside: "Countryside",
      "home-city": "Home city",
      industrial: "Industrial outskirts",
      woodland: "Woodland",
    },
  },
  pause: {
    home: "Back to title",
    resume: "Resume",
    settings: "Settings",
    title: "Paused",
  },
  quips: {},
  // PLACEHOLDER: until gameplay writes the question.
  restart: {
    cancel: "Cancel",
    question: "Start again from the first zone?",
    restart: "Restart",
    title: "Restart",
  },
  room: {
    leave: "Leave",
  },
  rooms: {
    // PLACEHOLDER: until gameplay designs the rooms.
    test: { name: "Test room" },
  },
  settings: {
    actionButtons: "Action buttons",
    install: "Install",
    installButton: "Install",
    installSteps: {
      firefoxAndroid: { first: "Tap the menu, then More.", second: "Tap Add app to Home screen." },
      ios: { first: "Tap Share.", second: "Tap Add to Home Screen." },
      title: "Install",
    },
    moveControls: "Move controls",
    title: "Settings",
  },
  start: {
    continue: "Continue",
    exit: "Exit",
    restart: "Restart",
    settings: "Settings",
    start: "Start",
  },
  update: {
    accept: "Update now",
    title: "Update available",
  },
};
