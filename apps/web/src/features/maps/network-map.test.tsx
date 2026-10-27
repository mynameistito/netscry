// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NetworkMap } from "./network-map";
import { observeMapNearViewport } from "./observe-map-near-viewport";

let observedRootMargin = "";

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly scrollMargin = "";
  readonly thresholds: readonly number[] = [];
  private observedTarget: Element | null = null;
  private readonly records: IntersectionObserverEntry[] = [];

  constructor(
    _callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.rootMargin = options?.rootMargin ?? "";
    observedRootMargin = this.rootMargin;
  }

  disconnect() {
    this.observedTarget = null;
  }

  observe(target: Element) {
    this.observedTarget = target;
  }

  takeRecords() {
    return this.records;
  }

  unobserve(target: Element) {
    if (this.observedTarget === target) {
      this.observedTarget = null;
    }
  }
}

describe(NetworkMap, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    observedRootMargin = "";
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

  it("reserves the map frame while its components load", () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);

    render(
      <NetworkMap
        location={{
          label: "Auckland",
          latitude: -37.01199,
          longitude: 174.786331,
        }}
      />
    );

    expect(observedRootMargin).toBe("200px 0px");
    expect(
      screen.getByText("Loading approximate network location map")
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Approximate network location map" })
        .className
    ).toContain("h-64");
    expect(
      screen.getByRole("region", { name: "Approximate network location map" })
        .className
    ).toContain("sm:h-80");
    expect(
      screen.getByText(
        /Your browser requests map tiles directly from OpenFreeMap/u
      )
    ).toBeTruthy();
  });

  it("loads once the map frame intersects its viewport margin", () => {
    const target: Element = document.createElement("div");

    const observerState = {
      disconnected: false,
      rootMargin: "",
      target,
    };

    let notifyIntersection: ((isIntersecting: boolean) => void) | undefined;
    const loadMap = vi.fn<() => void>();

    observeMapNearViewport(target, loadMap, (callback, rootMargin) => {
      notifyIntersection = callback;
      observerState.rootMargin = rootMargin;

      return {
        disconnect: () => {
          observerState.disconnected = true;
        },
        observe: (element) => {
          observerState.target = element;
        },
      };
    });

    expect(observerState).toStrictEqual({
      disconnected: false,
      rootMargin: "200px 0px",
      target,
    });
    expect(loadMap).not.toHaveBeenCalled();
    notifyIntersection?.(false);
    expect(loadMap).not.toHaveBeenCalled();
    notifyIntersection?.(true);
    expect(loadMap).toHaveBeenCalledOnce();
    expect(observerState.disconnected).toBeTruthy();
  });
});
