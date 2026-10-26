// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NetworkMap } from "./network-map";

describe(NetworkMap, () => {
  afterEach(() => {
    cleanup();
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
});
