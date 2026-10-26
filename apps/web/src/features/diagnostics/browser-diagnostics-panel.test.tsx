// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrowserDiagnosticsSnapshot } from "./browser-diagnostics";
import { BrowserDiagnosticsPanel } from "./browser-diagnostics-panel";

const snapshot: BrowserDiagnosticsSnapshot = {
  browser: "Firefox",
  browserVersion: "128.0",
  operatingSystem: "Linux",
  deviceCategory: "desktop",
  userAgent: "Mozilla/5.0 Firefox/128.0",
  languages: ["en-NZ", "mi-NZ"],
  timezone: "Pacific/Auckland",
  screen: { width: 1920, height: 1080 },
  viewport: { width: 1280, height: 720 },
  devicePixelRatio: 1.5,
  online: true,
  colorScheme: "light",
  reducedMotion: false,
  network: {
    effectiveType: null,
    downlinkMbps: null,
    rttMs: null,
    saveData: null,
  },
  navigation: {
    responseStartMs: 30,
    domInteractiveMs: null,
    domContentLoadedMs: null,
    loadEventMs: null,
  },
  capabilities: {
    secureContext: true,
    clipboardApi: false,
    serviceWorker: true,
    webGl: true,
  },
};

describe(BrowserDiagnosticsPanel, () => {
  afterEach(() => {
    cleanup();
  });

  it("reads only after requested and labels results as local browser data", () => {
    const read = vi.fn<() => BrowserDiagnosticsSnapshot>(() => snapshot);

    render(<BrowserDiagnosticsPanel read={read} />);

    expect({
      readCount: read.mock.calls.length,
      idleMessage: screen.getByText("No browser details have been read.")
        .textContent,
      privacyNotice: screen
        .getByText(/not sent or saved/u)
        .textContent?.includes("not sent or saved"),
    }).toStrictEqual({
      readCount: 0,
      idleMessage: "No browser details have been read.",
      privacyNotice: true,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Read browser details" })
    );

    const panel = screen.getByRole("region", { name: "Browser diagnostics" });
    const content = panel.textContent ?? "";

    expect([
      read.mock.calls.length,
      content.includes("Firefox"),
      content.includes("Linux"),
      content.includes("this browser"),
      content.includes("1920 × 1080 px"),
      content.includes("User-Agent string"),
    ]).toStrictEqual([1, true, true, true, true, true]);
    const userAgent = screen.getByText(snapshot.userAgent);
    expect(userAgent.closest("details")?.hasAttribute("open")).toBeFalsy();

    fireEvent.click(
      screen.getByText("User-Agent string", { selector: "summary" })
    );

    expect(userAgent.closest("details")?.hasAttribute("open")).toBeTruthy();
  });

  it("shows a safe unavailable state if browser APIs cannot be read", () => {
    render(
      <BrowserDiagnosticsPanel
        read={() => {
          throw new Error("private browser detail");
        }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Read browser details" })
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Browser details are unavailable"
    );
    expect(screen.queryByText("private browser detail")).toBeNull();
  });
});
