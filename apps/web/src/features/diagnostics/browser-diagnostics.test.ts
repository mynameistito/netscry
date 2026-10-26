import { describe, expect, it } from "vitest";

import { normalizeBrowserDiagnostics } from "./browser-diagnostics";
import type { BrowserDiagnosticsEnvironment } from "./browser-diagnostics";

const environment = (
  overrides: Partial<BrowserDiagnosticsEnvironment> = {}
): BrowserDiagnosticsEnvironment => ({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.2 Safari/537.36 Edg/135.2",
  platform: "Win32",
  language: "en-NZ",
  languages: ["en-NZ", "mi-NZ", "en", "fr", "de", "es"],
  timezone: "Pacific/Auckland",
  screenWidth: 2560,
  screenHeight: 1440,
  viewportWidth: 1280,
  viewportHeight: 800,
  devicePixelRatio: 2,
  online: true,
  colorScheme: "dark",
  reducedMotion: true,
  networkInformation: {
    effectiveType: "4g",
    downlink: 25,
    rtt: 72,
    saveData: true,
  },
  navigationTiming: {
    responseStart: 45,
    domInteractive: 510,
    domContentLoadedEventEnd: 640,
    loadEventEnd: 820,
  },
  capabilities: {
    secureContext: true,
    clipboardApi: true,
    serviceWorker: true,
    webGl: true,
  },
  ...overrides,
});

describe(normalizeBrowserDiagnostics, () => {
  it("normalizes browser, display, preference, network, timing, and capability values", () => {
    const snapshot = normalizeBrowserDiagnostics(environment());

    expect(snapshot).toStrictEqual({
      browser: "Microsoft Edge",
      browserVersion: "135.2",
      operatingSystem: "Windows",
      deviceCategory: "desktop",
      userAgent: environment().userAgent,
      languages: ["en-NZ", "mi-NZ", "en", "fr", "de"],
      timezone: "Pacific/Auckland",
      screen: { width: 2560, height: 1440 },
      viewport: { width: 1280, height: 800 },
      devicePixelRatio: 2,
      online: true,
      colorScheme: "dark",
      reducedMotion: true,
      network: {
        effectiveType: "4g",
        downlinkMbps: 25,
        rttMs: 72,
        saveData: true,
      },
      navigation: {
        responseStartMs: 45,
        domInteractiveMs: 510,
        domContentLoadedMs: 640,
        loadEventMs: 820,
      },
      capabilities: {
        secureContext: true,
        clipboardApi: true,
        serviceWorker: true,
        webGl: true,
      },
    });
  });

  it("keeps unsupported and not-yet-recorded values unavailable", () => {
    const snapshot = normalizeBrowserDiagnostics(
      environment({
        userAgent: "unrecognized agent",
        platform: "unknown",
        language: "en-GB",
        languages: [],
        timezone: null,
        networkInformation: null,
        navigationTiming: null,
      })
    );

    expect({
      browser: snapshot.browser,
      version: snapshot.browserVersion,
      operatingSystem: snapshot.operatingSystem,
      category: snapshot.deviceCategory,
      languages: snapshot.languages,
      timezone: snapshot.timezone,
      network: snapshot.network,
      navigation: snapshot.navigation,
    }).toStrictEqual({
      browser: "Unidentified browser",
      version: null,
      operatingSystem: null,
      category: "desktop",
      languages: ["en-GB"],
      timezone: null,
      network: {
        effectiveType: null,
        downlinkMbps: null,
        rttMs: null,
        saveData: null,
      },
      navigation: {
        responseStartMs: null,
        domInteractiveMs: null,
        domContentLoadedMs: null,
        loadEventMs: null,
      },
    });
  });

  it("coarsely labels mobile devices without adding a persistent identifier", () => {
    const snapshot = normalizeBrowserDiagnostics(
      environment({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1",
        platform: "iPhone",
      })
    );

    expect({
      browser: snapshot.browser,
      operatingSystem: snapshot.operatingSystem,
      category: snapshot.deviceCategory,
      userAgent: snapshot.userAgent,
    }).toStrictEqual({
      browser: "Safari",
      operatingSystem: "iOS or iPadOS",
      category: "mobile",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1",
    });
  });
});
