import { CHUNKS } from "../data/chunks.ts";
import type { ZoneKey } from "../data/types/index.ts";
import { ZONE_FRAMES } from "../data/zoneFrames.ts";
import type { AcceptanceTarget } from "./arenaAcceptance.ts";
import { CONNECTOR_ROUTE_TICKS, type ConnectorRoute } from "./connectorRoute.ts";
import { layoutOf } from "./pairCertify.ts";
import { REQUIRED_CHUNK_ROUTES } from "./requiredRoutes.ts";

// CONNECTOR ROUTES: the authored connectors whose only other route proof is the search-based
// chunk walk. The acceptance batch (src/tools/arenaAcceptance.ts) crosses each with the ordinary
// connector controller (connectorRoute.ts) in every zone that lists it.
export const ACCEPTANCE_CONNECTORS: readonly string[] = [
  "home-deep-ascent",
  "home-deep-descent",
  "home-timed-descent",
  "home-timed-return",
  "outdoor-deep-ascent",
  "outdoor-deep-descent",
  "outdoor-descent",
  "woodland-deep-descent",
  "woodland-timed-return",
];

export interface ConnectorCase {
  readonly connector: string;
  readonly theme: string;
  readonly zone: ZoneKey;
}

// Each connector in every zone that lists it, in the first theme of each physics kind there, as
// the certified lists' proofs walk a pool entry.
export function connectorCases(connectors: readonly string[]): ConnectorCase[] {
  return connectors.flatMap((connector) =>
    (Object.keys(ZONE_FRAMES) as ZoneKey[])
      .filter((zone) => ZONE_FRAMES[zone].connectors.includes(connector))
      .flatMap((zone) =>
        layoutOf(zone, {
          chunk: CHUNKS[connector]!,
          fills: undefined,
          id: connector,
          kind: "single",
          targets: REQUIRED_CHUNK_ROUTES[connector] ?? [],
        }).themes.map((theme) => ({ connector, theme, zone })),
      ),
  );
}

// The targets a connector's route misses.
export function missedConnectorTargets(route: ConnectorRoute): AcceptanceTarget[] {
  return route.cleared &&
    route.death === undefined &&
    !route.airJumped &&
    route.passedGate === route.gate &&
    route.ticks <= CONNECTOR_ROUTE_TICKS
    ? []
    : ["ordinary-route"];
}
