import {
  ExternalProviderError,
  DnsLookupResponseSchema,
} from "@netscry/schemas";
import type { DnsRecordType } from "@netscry/schemas";
import { Effect, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { DnsService, layer } from "./dns.ts";
import type { DnsJsonFetcher, DnsJsonRequest } from "./dns.ts";

const makeFetcher =
  (response: Schema.Json, requests: DnsJsonRequest[] = []): DnsJsonFetcher =>
  (request, schema) => {
    requests.push(request);

    return Schema.decodeUnknownEffect(schema)(response).pipe(
      Effect.mapError(
        () =>
          new ExternalProviderError({
            provider: "cloudflare-doh",
            operation: "dns-lookup",
            reason: "invalid-response",
            retryable: false,
          })
      )
    );
  };

const lookup = (
  serviceLayer: Layer.Layer<DnsService>,
  query: string,
  recordType: DnsRecordType
) =>
  Effect.gen(function* runLookup() {
    const service = yield* DnsService;

    return yield* service.lookup(query, recordType);
  }).pipe(Effect.provide(serviceLayer));

describe(DnsService, () => {
  it("queries Cloudflare DoH JSON and returns normalized, attributed answers", async () => {
    const requests: DnsJsonRequest[] = [];

    const serviceLayer = layer(
      makeFetcher(
        {
          Status: 0,
          TC: false,
          AD: true,
          Answer: [
            {
              name: "Example.COM.",
              type: 1,
              TTL: 60,
              data: "192.0.2.10",
            },
          ],
        },
        requests
      )
    );

    const response = await Effect.runPromise(
      lookup(serviceLayer, "  Example.com. ", "A")
    );

    expect(response).toMatchObject({
      query: "example.com",
      recordType: "A",
      status: 0,
      dnssecAuthenticated: true,
      cacheTtlSeconds: 60,
      records: [
        {
          name: "example.com",
          type: "A",
          ttl: 60,
          data: {
            type: "A",
            address: { version: 4, canonical: "192.0.2.10" },
          },
        },
      ],
      attribution: {
        resolver: "Cloudflare 1.1.1.1",
        resolverUrl: "https://cloudflare-dns.com/dns-query",
      },
    });
    expect(
      Schema.decodeUnknownSync(DnsLookupResponseSchema)(response)
    ).toStrictEqual(response);
    expect(new URL(requests[0]?.url ?? "invalid").searchParams).toStrictEqual(
      new URLSearchParams("name=example.com&type=A")
    );
  });

  it.each([
    ["A", 1, "192.0.2.4"],
    ["AAAA", 28, "2001:db8::1"],
    ["CAA", 257, '0 issue "letsencrypt.org"'],
    ["CNAME", 5, "edge.example.com."],
    ["MX", 15, "10 mail.example.com."],
    ["NS", 2, "ns.example.com."],
    ["PTR", 12, "host.example.com."],
    ["SOA", 6, "ns.example.com. hostmaster.example.com. 1 2 3 4 5"],
    ["SRV", 33, "10 20 443 service.example.com."],
    ["TXT", 16, '"v=spf1 -all"'],
  ] as const)(
    "normalizes %s answer records",
    async (recordType, code, data) => {
      const response = await Effect.runPromise(
        lookup(
          layer(
            makeFetcher({
              Status: 0,
              Answer: [
                {
                  name: "example.com.",
                  type: code,
                  TTL: 45,
                  data,
                },
              ],
            })
          ),
          "example.com",
          recordType
        )
      );

      expect(response.records).toHaveLength(1);
      expect(response.records[0]).toMatchObject({ type: recordType, ttl: 45 });
    }
  );

  it.each([
    ["192.0.2.1", "1.2.0.192.in-addr.arpa"],
    [
      "2001:db8::1",
      "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa",
    ],
  ])("converts PTR address %s to %s", async (address, expectedName) => {
    const requests: DnsJsonRequest[] = [];

    const response = await Effect.runPromise(
      lookup(
        layer(makeFetcher({ Status: 0, Answer: [] }, requests)),
        address,
        "PTR"
      )
    );

    expect(response.query).toBe(expectedName);
    expect(
      new URL(requests[0]?.url ?? "invalid").searchParams.get("name")
    ).toBe(expectedName);
  });

  it("rejects invalid domains before contacting the resolver", async () => {
    const requests: DnsJsonRequest[] = [];

    const effect = Effect.gen(function* rejectInvalidQuery() {
      const service = yield* DnsService;

      return yield* Effect.flip(service.lookup("https://example.com", "A"));
    }).pipe(Effect.provide(layer(makeFetcher({ Status: 0 }, requests))));

    const error = await Effect.runPromise(effect);

    expect(error).toMatchObject({
      operation: "validate-query",
      reason: "invalid-request",
    });
    expect(requests).toHaveLength(0);
  });

  it("uses the minimum positive answer TTL and refreshes after expiry", async () => {
    let requests = 0;

    const serviceLayer = layer((_request, schema) => {
      requests += 1;

      return Schema.decodeUnknownEffect(schema)({
        Status: 0,
        Answer: [
          {
            name: "example.com.",
            type: 1,
            TTL: requests === 1 ? 10 : 20,
            data: "192.0.2.10",
          },
          {
            name: "example.com.",
            type: 1,
            TTL: 5,
            data: "192.0.2.11",
          },
        ],
      }).pipe(
        Effect.mapError(
          () =>
            new ExternalProviderError({
              provider: "cloudflare-doh",
              operation: "dns-lookup",
              reason: "invalid-response",
              retryable: false,
            })
        )
      );
    }).pipe(Layer.provideMerge(TestClock.layer()));

    const effect = Effect.gen(function* refreshAfterTtl() {
      const service = yield* DnsService;
      const first = yield* service.lookup("example.com", "A");
      const cached = yield* service.lookup("example.com", "A");
      yield* TestClock.adjust("5 seconds");
      const refreshed = yield* service.lookup("example.com", "A");

      return [first, cached, refreshed] as const;
    }).pipe(Effect.provide(serviceLayer));

    const [first, cached, refreshed] = await Effect.runPromise(effect);

    expect(first.cacheTtlSeconds).toBe(5);
    expect(cached).toStrictEqual(first);
    expect(refreshed.records[0]?.ttl).toBe(20);
    expect(requests).toBe(2);
  });

  it("keeps DNS cache entries across per-request service Layers", async () => {
    const requests: DnsJsonRequest[] = [];

    const fetcher = makeFetcher(
      {
        Status: 0,
        Answer: [
          {
            name: "example.com.",
            type: 1,
            TTL: 60,
            data: "192.0.2.10",
          },
        ],
      },
      requests
    );

    const first = await Effect.runPromise(
      lookup(layer(fetcher), "example.com", "A")
    );

    const second = await Effect.runPromise(
      lookup(layer(fetcher), "example.com", "A")
    );

    expect(second).toStrictEqual(first);
    expect(requests).toHaveLength(1);
  });

  it("caches negative answers using the SOA minimum and SOA TTL", async () => {
    let requests = 0;

    const serviceLayer = layer((_request, schema) => {
      requests += 1;

      return Schema.decodeUnknownEffect(schema)({
        Status: 3,
        Authority: [
          {
            name: "example.com.",
            type: 6,
            TTL: 90,
            data: "ns.example.com. hostmaster.example.com. 1 2 3 4 60",
          },
        ],
      }).pipe(
        Effect.mapError(
          () =>
            new ExternalProviderError({
              provider: "cloudflare-doh",
              operation: "dns-lookup",
              reason: "invalid-response",
              retryable: false,
            })
        )
      );
    }).pipe(Layer.provideMerge(TestClock.layer()));

    const effect = Effect.gen(function* cacheNegativeAnswer() {
      const service = yield* DnsService;
      const first = yield* service.lookup("missing.example.com", "A");
      const cached = yield* service.lookup("missing.example.com", "A");
      yield* TestClock.adjust("60 seconds");
      const refreshed = yield* service.lookup("missing.example.com", "A");

      return [first, cached, refreshed] as const;
    }).pipe(Effect.provide(serviceLayer));

    const [first, cached] = await Effect.runPromise(effect);

    expect(first.status).toBe(3);
    expect(first.cacheTtlSeconds).toBe(60);
    expect(cached).toStrictEqual(first);
    expect(requests).toBe(2);
  });

  it("does not cache records with a zero TTL", async () => {
    let requests = 0;

    const serviceLayer = layer((_request, schema) => {
      requests += 1;

      return Schema.decodeUnknownEffect(schema)({
        Status: 0,
        Answer: [
          {
            name: "example.com.",
            type: 1,
            TTL: 0,
            data: "192.0.2.10",
          },
        ],
      }).pipe(
        Effect.mapError(
          () =>
            new ExternalProviderError({
              provider: "cloudflare-doh",
              operation: "dns-lookup",
              reason: "invalid-response",
              retryable: false,
            })
        )
      );
    });

    const effect = Effect.gen(function* skipZeroTtl() {
      const service = yield* DnsService;

      yield* service.lookup("example.com", "A");
      yield* service.lookup("example.com", "A");
    }).pipe(Effect.provide(serviceLayer));

    await Effect.runPromise(effect);

    expect(requests).toBe(2);
  });

  it("does not cache failed resolver requests", async () => {
    let requests = 0;

    const serviceLayer = layer(() => {
      requests += 1;

      return Effect.fail(
        new ExternalProviderError({
          provider: "cloudflare-doh",
          operation: "dns-lookup",
          reason: "transport",
          retryable: true,
        })
      );
    });

    const effect = Effect.gen(function* retryFailedLookup() {
      const service = yield* DnsService;
      const first = yield* Effect.result(service.lookup("example.com", "A"));
      const second = yield* Effect.result(service.lookup("example.com", "A"));

      return [first, second] as const;
    }).pipe(Effect.provide(serviceLayer));

    const results = await Effect.runPromise(effect);

    expect(results).toHaveLength(2);
    expect(requests).toBe(2);
  });
});
