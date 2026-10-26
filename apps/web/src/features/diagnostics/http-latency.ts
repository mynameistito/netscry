import { calculateRttStatistics } from "@netscry/core";
import type { RttStatistics } from "@netscry/core";
import { Effect } from "effect";

const HEALTH_ENDPOINT = "/api/v1/health";
const SAMPLE_COUNT = 5;

type FetchResponse = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Browser timings and the corresponding summary statistics. */
export interface HttpLatencyMeasurement {
  readonly samplesMs: readonly number[];
  readonly statistics: RttStatistics;
}

/** Injectable browser boundary used by deterministic measurement tests. */
export interface HttpLatencyMeasurementOptions {
  readonly fetchResponse?: FetchResponse;
  readonly now?: () => number;
  readonly pause?: () => Effect.Effect<void>;
}

const measureSample = (
  index: number,
  options: Required<HttpLatencyMeasurementOptions>
): Effect.Effect<number, Error> =>
  Effect.gen(function* measureOneHttpSample() {
    if (index > 0) {
      yield* options.pause();
    }

    const startedAt = options.now();

    const response = yield* Effect.tryPromise({
      try: async (signal) =>
        await options.fetchResponse(HEALTH_ENDPOINT, {
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          signal,
        }),
      catch: () => new Error("HTTP latency measurement failed."),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new Error("The same-origin health endpoint was unavailable.")
      );
    }

    return Math.max(0, options.now() - startedAt);
  });

/** Measure the browser-to-NetScry HTTP path using sequential same-origin requests.
 * @param input - Optional browser-boundary functions used for deterministic tests.
 * @returns Five response-header timings and their summary statistics.
 */
export const measureHttpLatency = Effect.fn("HttpLatency.measure")(
  function* measureHttpLatency(input: HttpLatencyMeasurementOptions = {}) {
    const options: Required<HttpLatencyMeasurementOptions> = {
      fetchResponse: input.fetchResponse ?? globalThis.fetch,
      now: input.now ?? (() => performance.now()),
      pause: input.pause ?? (() => Effect.sleep("250 millis")),
    };

    const samples = Array.from({ length: SAMPLE_COUNT }, (_, index) =>
      measureSample(index, options)
    );

    const samplesMs = yield* Effect.all(samples, { concurrency: 1 });

    const result = calculateRttStatistics(samplesMs);

    if (result._tag === "Err") {
      return yield* Effect.fail(
        new Error("HTTP latency samples could not be summarized.")
      );
    }

    const measurement: HttpLatencyMeasurement = {
      samplesMs,
      statistics: result.value,
    };

    return measurement;
  }
);
