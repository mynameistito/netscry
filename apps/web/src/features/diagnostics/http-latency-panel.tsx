import { formatMilliseconds } from "@netscry/core";
import { Effect, Exit } from "effect";
import { useEffect, useRef, useState } from "react";

import { measureHttpLatency } from "./http-latency";
import type { HttpLatencyMeasurement } from "./http-latency";

type MeasurementState =
  | { readonly status: "idle" }
  | { readonly status: "running" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly measurement: HttpLatencyMeasurement };

const measurementButtonLabel = (status: MeasurementState["status"]) => {
  if (status === "running") {
    return "Measuring…";
  }

  if (status === "ready") {
    return "Measure again";
  }

  return "Measure HTTP latency";
};

/** A user-started browser HTTP measurement against NetScry's same-origin health endpoint.
 * @param props - Optional measurement implementation for isolated component tests.
 * @returns The browser latency panel.
 */
export const HttpLatencyPanel = ({
  measure = measureHttpLatency,
}: {
  readonly measure?: typeof measureHttpLatency;
}) => {
  const [state, setState] = useState<MeasurementState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    []
  );

  const startMeasurement = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "running" });

    const exit = await Effect.runPromiseExit(measure(), {
      signal: controller.signal,
    });

    if (controllerRef.current === controller) {
      controllerRef.current = null;
    }

    if (controller.signal.aborted) {
      return;
    }

    if (Exit.isSuccess(exit)) {
      setState({ status: "ready", measurement: exit.value });

      return;
    }

    setState({ status: "error" });
  };

  const stats = state.status === "ready" ? state.measurement.statistics : null;
  const buttonLabel = measurementButtonLabel(state.status);

  return (
    <section
      aria-labelledby="http-latency-title"
      className="border-border rounded-lg border"
    >
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5">
        <div className="space-y-1">
          <h2 className="text-sm font-medium" id="http-latency-title">
            Browser HTTP measurement
          </h2>
          <p className="text-muted-foreground max-w-2xl text-xs leading-5">
            Sends five sequential requests to this site&apos;s health endpoint.
            This measures the browser HTTP path to NetScry, not ICMP ping or
            packet-level jitter; values stay in this page and are not stored.
          </p>
        </div>
        <button
          className="border-input hover:bg-muted focus-visible:outline-ring inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
          disabled={state.status === "running"}
          onClick={() => {
            void startMeasurement();
          }}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>

      {state.status === "idle" ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">
          No browser requests have been measured yet.
        </p>
      ) : null}

      {state.status === "running" ? (
        <output className="text-muted-foreground block px-4 py-3 text-sm">
          Measuring five same-origin HTTP responses…
        </output>
      ) : null}

      {state.status === "error" ? (
        <p className="text-destructive px-4 py-3 text-sm" role="alert">
          The browser could not complete the same-origin HTTP measurement. Try
          again when the site is reachable.
        </p>
      ) : null}

      {stats === null ? null : (
        <dl className="grid gap-3 px-4 py-3 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">Samples</dt>
            <dd className="mt-1 text-sm tabular-nums">
              {stats.count} HTTP requests
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Minimum</dt>
            <dd className="mt-1 text-sm tabular-nums">
              {formatMilliseconds(stats.minimumMs)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Median</dt>
            <dd className="mt-1 text-sm tabular-nums">
              {formatMilliseconds(stats.medianMs)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Maximum</dt>
            <dd className="mt-1 text-sm tabular-nums">
              {formatMilliseconds(stats.maximumMs)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">
              Mean adjacent change
            </dt>
            <dd className="mt-1 text-sm tabular-nums">
              {stats.jitterMs === null
                ? "Unavailable"
                : formatMilliseconds(stats.jitterMs)}
            </dd>
          </div>
          <div className="text-muted-foreground text-xs leading-5 sm:col-span-3">
            Jitter is the mean absolute difference between consecutive HTTP
            samples, not an ICMP packet delay variation measurement.
          </div>
        </dl>
      )}
    </section>
  );
};
