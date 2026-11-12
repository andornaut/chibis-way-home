// The shared flow owns waiting workers and the page session's dismissal; this bridge guards
// visible controls.
export function createUpdateOffer(accept: () => void, dismiss: () => void) {
  let visible = false;
  let listener: ((visible: boolean) => void) | undefined;
  const setVisible = (next: boolean) => {
    if (next !== visible) {
      visible = next;
      listener?.(visible);
    }
  };
  return {
    accept() {
      if (visible) {
        setVisible(false);
        accept();
      }
    },
    defer() {
      if (visible) {
        setVisible(false);
        dismiss();
      }
    },
    setVisible,
    subscribe(next: (visible: boolean) => void) {
      listener = next;
      next(visible);
      return () => {
        if (listener === next) {
          listener = undefined;
        }
      };
    },
  };
}
