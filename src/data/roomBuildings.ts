import type { TileRect } from "./types";

export const ROOM_BUILDING_OPENING: TileRect = { col: 5, cols: 5, row: 8, rows: 7 };

export const ROOM_BUILDING_DOOR = "street-door";

export const ROOM_BUILDINGS: Readonly<Record<string, string>> = {
  "back-streets": "room-building-home-city",
  "city-boundary": "room-building-blue-cityscape",
  "city-outskirts": "room-building-home-city",
  "city-streets": "room-building-blue-cityscape",
  "country-lanes": "room-building-countryside",
  "deep-woods": "room-building-woodland",
  "familiar-neighbourhood": "room-building-home-city",
  farmland: "room-building-countryside",
  "forest-paths": "room-building-woodland",
  "freight-terminal": "room-building-industrial",
  "loading-yards": "room-building-industrial",
  ravine: "room-building-woodland",
  "river-crossing": "room-building-countryside",
  street: "room-building-blue-cityscape",
  "warehouse-district": "room-building-industrial",
};
