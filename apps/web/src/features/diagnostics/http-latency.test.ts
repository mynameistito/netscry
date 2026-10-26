import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { measureHttpLatency } from "./http-latency";

describe(measureHttpLatency, () => {
  it("measures five sequential same-origin health responses and summarizes them", async () => {
    const fetchResponse = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response(null, { status: 200 }));

    const readings = [0, 12, 20, 35, 40, 45, 50, 70, 80, 90];

    const now = vi.fn<() => number>(() => readings.shift() ?? 0);
    const pause = vi.fn<() => Effect.Effect<void>>(() => Effect.void);

    const measurement = await Effect.runPromise(
      measureHttpLatency({ fetchResponse, now, pause })
    );

    expect({
      samples: measurement.samplesMs,
      statistics: measurement.statistics,
    }).toStrictEqual({
      samples: [12, 15, 5, 20, 10],
      statistics: {
        count: 5,
        minimumMs: 5,
        medianMs: 12,
        maximumMs: 20,
        jitterMs: 9.5,
      },
    });

    const [firstCall] = fetchResponse.mock.calls;
    expect({
      fetchCount: fetchResponse.mock.calls.length,
      firstUrl: firstCall?.[0],
      cache: firstCall?.[1]?.cache,
      credentials: firstCall?.[1]?.credentials,
      redirect: firstCall?.[1]?.redirect,
      signalIsAbortSignal: firstCall?.[1]?.signal instanceof AbortSignal,
      pauseCount: pause.mock.calls.length,
    }).toStrictEqual({
      fetchCount: 5,
      firstUrl: "/api/v1/health",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signalIsAbortSignal: true,
      pauseCount: 4,
    });
  });

  it("fails with a safe error when the health endpoint returns an error", async () => {
    const fetchResponse = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      Effect.runPromise(
        measureHttpLatency({
          fetchResponse,
          now: () => 1,
          pause: () => Effect.void,
        })
      )
    ).rejects.toThrow("The same-origin health endpoint was unavailable.");
  });

  it("does not expose fetch failure details", async () => {
    const fetchResponse = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockRejectedValue(new Error("sensitive transport detail"));

    await expect(
      Effect.runPromise(
        measureHttpLatency({
          fetchResponse,
          now: () => 1,
          pause: () => Effect.void,
        })
      )
    ).rejects.toThrow("HTTP latency measurement failed.");
  });
});
