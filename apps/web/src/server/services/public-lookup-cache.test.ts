import { ExternalProviderError } from "@netscry/schemas";
import { Effect, Layer, Result, Schema } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { PublicLookupCache, layer } from "./public-lookup-cache.ts";
import type {
  PublicLookupCacheContract,
  PublicLookupCacheKey,
  PublicLookupCacheOptions,
} from "./public-lookup-cache.ts";

interface AsnLookup {
  readonly name: string;
  readonly source: string;
}

const asnLookupSchema = Schema.Struct({
  name: Schema.String,
  source: Schema.String,
});

const asnKey: PublicLookupCacheKey = {
  namespace: "asn",
  value: "13335",
};

const cacheLayer = (
  lookup: PublicLookupCacheOptions<AsnLookup>["lookup"],
  timeToLive: PublicLookupCacheOptions<AsnLookup>["timeToLive"] = "1 minute"
) =>
  layer({
    namespace: "asn",
    capacity: 16,
    timeToLive,
    lookup,
  });

const read = (cache: PublicLookupCacheContract, key = asnKey) =>
  cache.get(key, asnLookupSchema);

describe(PublicLookupCache, () => {
  it("caches successful public values and coalesces concurrent lookups", async () => {
    let lookups = 0;

    const effect = Effect.gen(function* getConcurrentValues() {
      const cache = yield* PublicLookupCache;

      return yield* Effect.all([read(cache), read(cache), read(cache)], {
        concurrency: "unbounded",
      });
    }).pipe(
      Effect.provide(
        cacheLayer((key) =>
          Effect.sync(() => {
            lookups += 1;

            return {
              name: `AS${key.value}`,
              source: key.namespace,
            };
          })
        )
      )
    );

    const results = await Effect.runPromise(effect);

    expect(results).toStrictEqual([
      { name: "AS13335", source: "asn" },
      { name: "AS13335", source: "asn" },
      { name: "AS13335", source: "asn" },
    ]);
    expect(lookups).toBe(1);
  });

  it("normalizes keys while keeping distinct variants separate", async () => {
    let lookups = 0;

    const effect = Effect.gen(function* separateVariants() {
      const cache = yield* PublicLookupCache;

      const first = yield* read(cache);
      const normalized = yield* read(cache, { ...asnKey, value: " 13335 " });
      const variant = yield* read(cache, { ...asnKey, variant: "rdap" });

      return [first, normalized, variant] as const;
    }).pipe(
      Effect.provide(
        cacheLayer((key) =>
          Effect.sync(() => {
            lookups += 1;

            return {
              name: `AS${key.value}-${key.variant ?? "default"}`,
              source: key.namespace,
            };
          })
        )
      )
    );

    const [first, normalized, variant] = await Effect.runPromise(effect);

    expect(normalized).toStrictEqual(first);
    expect(variant.name).toBe("AS13335-rdap");
    expect(lookups).toBe(2);
  });

  it("expires successful values according to the configured TTL", async () => {
    let lookups = 0;

    const publicCacheLayer = cacheLayer((key) =>
      Effect.sync(() => {
        lookups += 1;

        return { name: `AS${key.value}-${lookups}`, source: key.namespace };
      })
    ).pipe(Layer.provideMerge(TestClock.layer()));

    const effect = Effect.gen(function* readThroughExpiry() {
      const cache = yield* PublicLookupCache;
      const first = yield* read(cache);
      const cached = yield* read(cache);

      yield* TestClock.adjust("61 seconds");

      const refreshed = yield* read(cache);

      return [first, cached, refreshed] as const;
    }).pipe(Effect.provide(publicCacheLayer));

    const [first, cached, refreshed] = await Effect.runPromise(effect);

    expect(first.name).toBe("AS13335-1");
    expect(cached).toStrictEqual(first);
    expect(refreshed.name).toBe("AS13335-2");
    expect(lookups).toBe(2);
  });

  it("does not cache failed provider lookups", async () => {
    let lookups = 0;

    const effect = Effect.gen(function* retryAfterFailure() {
      const cache = yield* PublicLookupCache;
      const first = yield* Effect.result(read(cache));
      const second = yield* Effect.result(read(cache));

      return [first, second] as const;
    }).pipe(
      Effect.provide(
        cacheLayer(() =>
          Effect.gen(function* lookup() {
            lookups += 1;

            if (lookups === 1) {
              return yield* Effect.fail(
                new ExternalProviderError({
                  provider: "example-asn",
                  operation: "lookup-asn",
                  reason: "transport",
                  retryable: true,
                })
              );
            }

            return { name: "Recovered", source: "example-asn" };
          })
        )
      )
    );

    const [first, second] = await Effect.runPromise(effect);

    expect(Result.isFailure(first)).toBeTruthy();
    expect(Result.isSuccess(second)).toBeTruthy();
    expect(lookups).toBe(2);
  });

  it("isolates each Layer to its configured public namespace", async () => {
    let lookups = 0;

    const effect = Effect.gen(function* rejectWrongNamespace() {
      const cache = yield* PublicLookupCache;

      return yield* Effect.result(
        cache.get({ namespace: "ip", value: "203.0.113.10" }, asnLookupSchema)
      );
    }).pipe(
      Effect.provide(
        cacheLayer((key) =>
          Effect.sync(() => {
            lookups += 1;

            return { name: key.value, source: key.namespace };
          })
        )
      )
    );

    const result = await Effect.runPromise(effect);

    expect(Result.isFailure(result)).toBeTruthy();
    expect(lookups).toBe(0);
  });

  it("supports per-key and full cache invalidation", async () => {
    let lookups = 0;

    const effect = Effect.gen(function* invalidateValues() {
      const cache = yield* PublicLookupCache;
      const first = yield* read(cache);

      yield* cache.invalidate(asnKey);

      const second = yield* read(cache);

      yield* cache.clear();

      const third = yield* read(cache);

      return [first, second, third] as const;
    }).pipe(
      Effect.provide(
        cacheLayer((key) =>
          Effect.sync(() => {
            lookups += 1;

            return {
              name: `AS${key.value}-${lookups}`,
              source: key.namespace,
            };
          })
        )
      )
    );

    const [first, second, third] = await Effect.runPromise(effect);

    expect(first.name).toBe("AS13335-1");
    expect(second.name).toBe("AS13335-2");
    expect(third.name).toBe("AS13335-3");
    expect(lookups).toBe(3);
  });
});
