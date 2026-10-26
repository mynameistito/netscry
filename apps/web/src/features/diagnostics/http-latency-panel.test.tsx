// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import type { HttpLatencyMeasurement } from "./http-latency";
import { HttpLatencyPanel } from "./http-latency-panel";

const measurement: HttpLatencyMeasurement = {
  samplesMs: [10, 14, 12, 18, 16],
  statistics: {
    count: 5,
    minimumMs: 10,
    medianMs: 14,
    maximumMs: 18,
    jitterMs: 3,
  },
};

describe(HttpLatencyPanel, () => {
  afterEach(() => {
    cleanup();
  });

  it("describes a browser HTTP measurement and shows results after the user starts it", async () => {
    render(<HttpLatencyPanel measure={() => Effect.succeed(measurement)} />);

    expect(
      screen.getByText(/not ICMP ping or packet-level jitter/u)
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Measure HTTP latency" })
    );

    const panel = await screen.findByRole("region", {
      name: "Browser HTTP measurement",
    });

    const text = panel.textContent ?? "";

    expect([
      text.includes("5 HTTP requests"),
      text.includes("10 ms"),
      text.includes("14 ms"),
      text.includes("18 ms"),
      text.includes("3 ms"),
    ]).toStrictEqual([true, true, true, true, true]);
  });

  it("shows a safe failure message when the endpoint cannot be measured", async () => {
    render(
      <HttpLatencyPanel
        measure={() => Effect.fail(new Error("private transport detail"))}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Measure HTTP latency" })
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "could not complete the same-origin HTTP measurement"
    );
    expect(screen.queryByText("private transport detail")).toBeNull();
  });
});
