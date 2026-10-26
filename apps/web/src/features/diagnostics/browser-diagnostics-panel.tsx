import { formatMilliseconds } from "@netscry/core";
import { useState } from "react";

import { readBrowserDiagnostics } from "./browser-diagnostics";
import type { BrowserDiagnosticsSnapshot } from "./browser-diagnostics";

type BrowserDiagnosticsState =
  | { readonly status: "idle" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly snapshot: BrowserDiagnosticsSnapshot };

interface DiagnosticFieldProps {
  readonly label: string;
  readonly value: string | null;
}

const DiagnosticField = ({ label, value }: DiagnosticFieldProps) => (
  <div className="border-border min-w-0 border-b py-2 last:border-b-0">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="mt-1 text-sm break-words tabular-nums">
      {value ?? "Not exposed by this browser"}
    </dd>
  </div>
);

const pixels = (width: number, height: number) => `${width} × ${height} px`;

const dataSaverLabel = (value: boolean | null) => {
  if (value === null) {
    return null;
  }

  return value ? "Enabled" : "Disabled";
};

const fields = (snapshot: BrowserDiagnosticsSnapshot) => [
  { label: "Browser", value: snapshot.browser },
  { label: "Browser version", value: snapshot.browserVersion },
  { label: "Operating system", value: snapshot.operatingSystem },
  { label: "Device category", value: snapshot.deviceCategory },
  { label: "Preferred languages", value: snapshot.languages.join(", ") },
  { label: "Timezone", value: snapshot.timezone },
  {
    label: "Screen resolution",
    value: pixels(snapshot.screen.width, snapshot.screen.height),
  },
  {
    label: "Viewport",
    value: pixels(snapshot.viewport.width, snapshot.viewport.height),
  },
  { label: "Device pixel ratio", value: String(snapshot.devicePixelRatio) },
  {
    label: "Browser online state",
    value: snapshot.online ? "Online" : "Offline",
  },
  { label: "Colour scheme", value: snapshot.colorScheme },
  {
    label: "Reduced motion preference",
    value: snapshot.reducedMotion ? "Reduce motion" : "No preference",
  },
  { label: "Network effective type", value: snapshot.network.effectiveType },
  {
    label: "Network downlink estimate",
    value:
      snapshot.network.downlinkMbps === null
        ? null
        : `${snapshot.network.downlinkMbps} Mb/s`,
  },
  {
    label: "Network RTT estimate",
    value:
      snapshot.network.rttMs === null ? null : `${snapshot.network.rttMs} ms`,
  },
  {
    label: "Data saver",
    value: dataSaverLabel(snapshot.network.saveData),
  },
  {
    label: "Navigation response start",
    value:
      snapshot.navigation.responseStartMs === null
        ? null
        : formatMilliseconds(snapshot.navigation.responseStartMs),
  },
  {
    label: "Navigation DOM interactive",
    value:
      snapshot.navigation.domInteractiveMs === null
        ? null
        : formatMilliseconds(snapshot.navigation.domInteractiveMs),
  },
  {
    label: "Navigation DOM content loaded",
    value:
      snapshot.navigation.domContentLoadedMs === null
        ? null
        : formatMilliseconds(snapshot.navigation.domContentLoadedMs),
  },
  {
    label: "Navigation load event",
    value:
      snapshot.navigation.loadEventMs === null
        ? null
        : formatMilliseconds(snapshot.navigation.loadEventMs),
  },
  {
    label: "Secure context",
    value: snapshot.capabilities.secureContext ? "Supported" : "Unavailable",
  },
  {
    label: "Clipboard API",
    value: snapshot.capabilities.clipboardApi ? "Available" : "Unavailable",
  },
  {
    label: "Service workers",
    value: snapshot.capabilities.serviceWorker ? "Supported" : "Unavailable",
  },
  {
    label: "WebGL",
    value: snapshot.capabilities.webGl ? "Supported" : "Unavailable",
  },
];

/** Locally requested browser diagnostics, separate from request and Cloudflare metadata.
 * @param props - Optional read function for deterministic component tests.
 * @returns The local browser diagnostics panel.
 */
export const BrowserDiagnosticsPanel = ({
  read = readBrowserDiagnostics,
}: {
  readonly read?: typeof readBrowserDiagnostics;
}) => {
  const [state, setState] = useState<BrowserDiagnosticsState>({
    status: "idle",
  });

  const readLocalDiagnostics = () => {
    try {
      setState({ status: "ready", snapshot: read() });
    } catch {
      setState({ status: "error" });
    }
  };

  return (
    <section
      aria-labelledby="browser-diagnostics-title"
      className="border-border rounded-lg border"
    >
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5">
        <div className="space-y-1">
          <h2 className="text-sm font-medium" id="browser-diagnostics-title">
            Browser diagnostics
          </h2>
          <p className="text-muted-foreground max-w-2xl text-xs leading-5">
            These values come from this browser, not the Cloudflare request.
            They are read only when requested, remain in this page, and are not
            sent or saved. Display details can contribute to browser
            fingerprinting.
          </p>
        </div>
        <button
          className="border-input hover:bg-muted focus-visible:outline-ring inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={readLocalDiagnostics}
          type="button"
        >
          {state.status === "ready"
            ? "Refresh browser details"
            : "Read browser details"}
        </button>
      </div>

      {state.status === "idle" ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">
          No browser details have been read.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="text-destructive px-4 py-3 text-sm" role="alert">
          Browser details are unavailable in this environment.
        </p>
      ) : null}

      {state.status === "ready" ? (
        <div className="space-y-3 px-4 py-3">
          <p className="text-muted-foreground text-xs">
            Source: this browser · sampled on request · no persistent identifier
          </p>
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {fields(state.snapshot).map(({ label, value }) => (
              <DiagnosticField key={label} label={label} value={value} />
            ))}
          </dl>
          <details className="border-border rounded-md border px-3 py-2">
            <summary className="focus-visible:outline-ring cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2">
              User-Agent string
            </summary>
            <code className="text-muted-foreground mt-2 block text-xs leading-5 break-all">
              {state.snapshot.userAgent || "Not exposed by this browser"}
            </code>
          </details>
        </div>
      ) : null}
    </section>
  );
};
