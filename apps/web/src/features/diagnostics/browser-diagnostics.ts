/** Optional network quality hints exposed by browsers that implement Network Information. */
export interface BrowserNetworkInformation {
  readonly effectiveType?: string;
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
}

/** Navigator surface with the optional browser network hint API. */
interface NavigatorWithNetworkInformation extends Navigator {
  readonly connection?: BrowserNetworkInformation;
}

/** Values read from standard browser APIs for one local diagnostics snapshot. */
export interface BrowserDiagnosticsEnvironment {
  readonly userAgent: string;
  readonly platform: string;
  readonly language: string;
  readonly languages: readonly string[];
  readonly timezone: string | null;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
  readonly online: boolean;
  readonly colorScheme: "dark" | "light";
  readonly reducedMotion: boolean;
  readonly networkInformation: BrowserNetworkInformation | null;
  readonly navigationTiming: Pick<
    PerformanceNavigationTiming,
    | "responseStart"
    | "domInteractive"
    | "domContentLoadedEventEnd"
    | "loadEventEnd"
  > | null;
  readonly capabilities: {
    readonly secureContext: boolean;
    readonly clipboardApi: boolean;
    readonly serviceWorker: boolean;
    readonly webGl: boolean;
  };
}

/** Normalized on-device browser values prepared for local display. */
export interface BrowserDiagnosticsSnapshot {
  readonly browser: string;
  readonly browserVersion: string | null;
  readonly operatingSystem: string | null;
  readonly deviceCategory: "desktop" | "tablet" | "mobile";
  readonly userAgent: string;
  readonly languages: readonly string[];
  readonly timezone: string | null;
  readonly screen: { readonly width: number; readonly height: number };
  readonly viewport: { readonly width: number; readonly height: number };
  readonly devicePixelRatio: number;
  readonly online: boolean;
  readonly colorScheme: "dark" | "light";
  readonly reducedMotion: boolean;
  readonly network: {
    readonly effectiveType: string | null;
    readonly downlinkMbps: number | null;
    readonly rttMs: number | null;
    readonly saveData: boolean | null;
  };
  readonly navigation: {
    readonly responseStartMs: number | null;
    readonly domInteractiveMs: number | null;
    readonly domContentLoadedMs: number | null;
    readonly loadEventMs: number | null;
  };
  readonly capabilities: BrowserDiagnosticsEnvironment["capabilities"];
}

const browserMatch = (userAgent: string) => {
  const patterns: readonly [name: string, expression: RegExp][] = [
    ["Microsoft Edge", /(?:Edg|EdgA|EdgiOS)\/(?<version>[\d.]+)/u],
    ["Opera", /(?:OPR|Opera)\/(?<version>[\d.]+)/u],
    ["Firefox", /(?:Firefox|FxiOS)\/(?<version>[\d.]+)/u],
    ["Google Chrome", /(?:Chrome|CriOS)\/(?<version>[\d.]+)/u],
    ["Safari", /Version\/(?<version>[\d.]+)/u],
  ];

  for (const [name, expression] of patterns) {
    const match = expression.exec(userAgent);

    if (match !== null) {
      return { browser: name, version: match.groups?.version ?? null };
    }
  }

  return { browser: "Unidentified browser", version: null };
};

const operatingSystem = (userAgent: string, platform: string) => {
  if (/Windows/u.test(userAgent) || platform.startsWith("Win")) {
    return "Windows";
  }

  if (/Android/u.test(userAgent)) {
    return "Android";
  }

  if (
    /iPhone|iPad|iPod/u.test(userAgent) ||
    /iPhone|iPad|iPod/u.test(platform)
  ) {
    return "iOS or iPadOS";
  }

  if (/Mac OS X/u.test(userAgent) || platform.startsWith("Mac")) {
    return "macOS";
  }

  if (/Linux/u.test(userAgent) || platform.startsWith("Linux")) {
    return "Linux";
  }

  return null;
};

const deviceCategory = (userAgent: string) => {
  if (/iPad|Tablet/u.test(userAgent)) {
    return "tablet" as const;
  }

  if (/Mobi|iPhone|iPod|Android/u.test(userAgent)) {
    return "mobile" as const;
  }

  return "desktop" as const;
};

const nonNegativeNumber = (value: number | undefined): number | null =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;

const positiveTiming = (value: number | undefined): number | null => {
  const timing = nonNegativeNumber(value);

  return timing !== null && timing > 0 ? timing : null;
};

const optionalString = (value: string | undefined): string | null =>
  value !== undefined && value.length > 0 ? value : null;

/** Normalize local browser diagnostics without retaining or transmitting them.
 * @param environment - Values read from standard browser APIs.
 * @returns A bounded, display-ready browser snapshot.
 */
export const normalizeBrowserDiagnostics = (
  environment: BrowserDiagnosticsEnvironment
): BrowserDiagnosticsSnapshot => {
  const browser = browserMatch(environment.userAgent);

  return {
    browser: browser.browser,
    browserVersion: browser.version,
    operatingSystem: operatingSystem(
      environment.userAgent,
      environment.platform
    ),
    deviceCategory: deviceCategory(environment.userAgent),
    userAgent: environment.userAgent,
    languages: (environment.languages.length > 0
      ? environment.languages
      : [environment.language]
    ).slice(0, 5),
    timezone: environment.timezone,
    screen: {
      width: environment.screenWidth,
      height: environment.screenHeight,
    },
    viewport: {
      width: environment.viewportWidth,
      height: environment.viewportHeight,
    },
    devicePixelRatio: environment.devicePixelRatio,
    online: environment.online,
    colorScheme: environment.colorScheme,
    reducedMotion: environment.reducedMotion,
    network: {
      effectiveType: optionalString(
        environment.networkInformation?.effectiveType
      ),
      downlinkMbps: nonNegativeNumber(environment.networkInformation?.downlink),
      rttMs: nonNegativeNumber(environment.networkInformation?.rtt),
      saveData: environment.networkInformation?.saveData ?? null,
    },
    navigation: {
      responseStartMs: positiveTiming(
        environment.navigationTiming?.responseStart
      ),
      domInteractiveMs: positiveTiming(
        environment.navigationTiming?.domInteractive
      ),
      domContentLoadedMs: positiveTiming(
        environment.navigationTiming?.domContentLoadedEventEnd
      ),
      loadEventMs: positiveTiming(environment.navigationTiming?.loadEventEnd),
    },
    capabilities: environment.capabilities,
  };
};

/** Read browser details on demand from standard APIs; no storage or network calls are made.
 * @returns A normalized snapshot from this tab's current browser environment.
 */
export const readBrowserDiagnostics = (): BrowserDiagnosticsSnapshot => {
  const browserNavigator: NavigatorWithNetworkInformation = navigator;
  let timezone: string | null = null;

  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    timezone = null;
  }

  const navigationTiming = performance
    .getEntriesByType("navigation")
    .find(
      (entry): entry is PerformanceNavigationTiming =>
        entry.entryType === "navigation"
    );

  return normalizeBrowserDiagnostics({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages,
    timezone,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    online: navigator.onLine,
    colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    networkInformation: browserNavigator.connection ?? null,
    navigationTiming: navigationTiming ?? null,
    capabilities: {
      secureContext: window.isSecureContext,
      clipboardApi: navigator.clipboard !== undefined,
      serviceWorker: "serviceWorker" in navigator,
      webGl:
        "WebGLRenderingContext" in window || "WebGL2RenderingContext" in window,
    },
  });
};
