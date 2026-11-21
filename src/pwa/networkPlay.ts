// Whether this session plays from the network because the device could not install the game:
// the kit launch reports it once (onNetworkPlay, for "unsupported" or "quota") before the game
// exists, and the notice scene takes it once to show its notice.
export function createNetworkPlay() {
  let pending = false;
  let reported = false;
  return {
    // The launch's onNetworkPlay, whatever its reason. A second report in the session is ignored.
    report(): void {
      if (!reported) {
        reported = true;
        pending = true;
      }
    },
    // Whether the notice is still to show: true once after a report, then false.
    take(): boolean {
      const shown = pending;
      pending = false;
      return shown;
    },
  };
}
