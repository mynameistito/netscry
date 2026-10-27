// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NetworkMap } from "./network-map";

describe(NetworkMap, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not show or load a map without location data", () => {
    render(<NetworkMap location={null} />);

    expect(
      screen.getByRole("heading", { name: "Location data unavailable" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Approximate network location map" })
    ).toBeNull();
  });

  it("rejects coordinates outside geographic bounds", () => {
    render(
      <NetworkMap
        location={{ label: "Invalid location", latitude: 91, longitude: 0 }}
      />
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "outside valid latitude or longitude bounds"
    );
  });

  it("defers loading the map until it nears the viewport", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        readonly root = null;
        readonly rootMargin = "";
        readonly thresholds: ReadonlyArray<number> = [];

        disconnect() {}
        observe() {}
        takeRecords() {
          return [];
        }
        unobserve() {}
      }
    );

    render(
      <NetworkMap
        location={{
          label: "Auckland",
          latitude: -37.01199,
          longitude: 174.786331,
        }}
      />
    );

    expect(
      screen.getByText("Loading approximate network location map")
    ).toBeTruthy();
  });
});
