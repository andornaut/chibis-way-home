import { describe, expect, it, vi } from "vitest";

import { trackHomeScreen } from "./homeScreen.ts";

describe("Start-only update eligibility", () => {
  it("reports true arrivals separately from card closure and repeated visibility", () => {
    const arrive = vi.fn();
    const home = trackHomeScreen(vi.fn(), vi.fn(), arrive);
    home.startShown(true);
    home.startShown(true);
    home.cover("startCard", true);
    home.cover("startCard", false);
    expect(arrive).toHaveBeenCalledOnce();
    home.startShown(false);
    home.startShown(true);
    expect(arrive).toHaveBeenCalledTimes(2);
  });

  it("retains first-prepared-zone registration independently of the current screen", () => {
    const visible = vi.fn();
    const register = vi.fn();
    const home = trackHomeScreen(visible, register);
    home.cover("loading", true);
    home.shown();
    expect(register).not.toHaveBeenCalled();
    home.cover("loading", false);
    home.shown();
    home.cover("death", true);
    home.cover("death", false);
    expect(register).toHaveBeenCalledOnce();
    expect(visible).not.toHaveBeenCalled();
  });

  it("suppresses Start offers beneath Settings, Restart and their nested cards", () => {
    const visible = vi.fn();
    const register = vi.fn();
    const home = trackHomeScreen(visible, register);
    home.startShown(true);
    home.cover("startCard", true);
    home.shown();
    expect(register).toHaveBeenCalledOnce();
    home.cover("startCard", true);
    home.cover("startCard", false);
    expect(visible.mock.calls).toEqual([[true], [false], [true]]);
  });

  it("keeps offers hidden after Start exits, including during play and its card transitions", () => {
    const visible = vi.fn();
    const home = trackHomeScreen(visible, vi.fn());
    home.startShown(true);
    home.startShown(false);
    home.shown();
    home.cover("pauseCard", true);
    home.cover("pauseCard", false);
    expect(visible.mock.calls).toEqual([[true], [false]]);
    home.startShown(true);
    expect(visible.mock.calls).toEqual([[true], [false], [true]]);
  });
});
