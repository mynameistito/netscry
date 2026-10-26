import {
  AsnNumberSchema,
  ExternalProviderError,
  PublicAsnLookupResponseSchema,
  PublicBgpPrefixLookupResponseSchema,
  RdapNormalizedRecordSchema,
} from "@netscry/schemas";
import { Effect, Layer, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { AsnBgpService, layer } from "./asn-bgp.ts";
import type {
  RouteViewsJsonFetcher,
  RouteViewsJsonRequest,
} from "./asn-bgp.ts";
import { RdapService } from "./rdap.ts";

const holderRecord = Schema.decodeUnknownSync(RdapNormalizedRecordSchema)({
  kind: "asn",
  query: "AS13335",
  data: {
    name: "Cloudflare, Inc.",
    statuses: [],
    events: [],
    nameservers: [],
    entities: [],
  },
  attribution: {
    source: "third-party",
    registryUrl: "https://data.iana.org/rdap/asn.json",
    registryPublication: "2026-10-22T23:00:04Z",
    serviceUrl: "https://rdap.example.test/",
    queryUrl: "https://rdap.example.test/autnum/13335",
    matchedEntry: "13335-13335",
  },
  raw: { name: "Cloudflare, Inc." },
});

const routeObservation = {
  prefix: "192.0.2.0/24",
  origin_asn: 13_335,
  rpki_state: "valid",
  reporting_peers: [
    {
      peer_asn: 6939,
      peer_addr: "2001:db8::1",
      collector: "route-views6",
      as_path: "6939 13335 13335",
      communities: "6939:100 6939:200",
      timestamp: "2026-10-27T12:30:00Z",
    },
  ],
};

const makeFetcher =
  (
    respond: (request: RouteViewsJsonRequest) => Schema.Json,
    requests: RouteViewsJsonRequest[] = [],
    shouldFail: (request: RouteViewsJsonRequest) => boolean = () => false
  ): RouteViewsJsonFetcher =>
  (request, schema) => {
    requests.push(request);

    if (shouldFail(request)) {
      return Effect.fail(
        new ExternalProviderError({
          provider: "routeviews",
          operation: "routing-lookup",
          reason: "transport",
          retryable: true,
        })
      );
    }

    return Schema.decodeUnknownEffect(schema)(respond(request)).pipe(
      Effect.mapError(
        () =>
          new ExternalProviderError({
            provider: "routeviews",
            operation: "routing-lookup",
            reason: "invalid-response",
            retryable: false,
          })
      )
    );
  };

const makeRdapLayer = (
  result: typeof holderRecord | ExternalProviderError = holderRecord
) =>
  Layer.succeed(
    RdapService,
    RdapService.of({
      lookup: () =>
        result instanceof ExternalProviderError
          ? Effect.fail(result)
          : Effect.succeed(result),
    })
  );

const lookupAsn = (serviceLayer: Layer.Layer<AsnBgpService>, asn: string) =>
  Effect.gen(function* runLookup() {
    const service = yield* AsnBgpService;

    return yield* service.lookupAsn(asn);
  }).pipe(Effect.provide(serviceLayer));

const lookupPrefix = (
  serviceLayer: Layer.Layer<AsnBgpService>,
  prefix: string
) =>
  Effect.gen(function* runLookup() {
    const service = yield* AsnBgpService;

    return yield* service.lookupPrefix(prefix);
  }).pipe(Effect.provide(serviceLayer));

describe(AsnBgpService, () => {
  it("keeps ASN contract values within the usable 32-bit range", () => {
    expect(
      Schema.decodeUnknownResult(AsnNumberSchema)(4_294_967_294)._tag
    ).toBe("Success");
    expect(
      Schema.decodeUnknownResult(AsnNumberSchema)(4_294_967_295)._tag
    ).toBe("Failure");
  });

  it("combines RDAP holder data and canonical RouteViews IPv4/IPv6 prefixes", async () => {
    const requests: RouteViewsJsonRequest[] = [];

    const serviceLayer = layer(
      makeFetcher(() => ["192.0.2.0/24", "2001:db8::/32"], requests),
      makeRdapLayer()
    );

    const response = await Effect.runPromise(
      lookupAsn(serviceLayer, " as013335 ")
    );

    expect(
      Schema.decodeUnknownSync(PublicAsnLookupResponseSchema)(response)
    ).toStrictEqual(response);
    expect(response).toMatchObject({
      kind: "asn",
      asn: 13_335,
      holder: {
        _tag: "Available",
        source: "third-party",
        value: "Cloudflare, Inc.",
      },
      announcedPrefixes: {
        _tag: "Available",
        value: [
          { prefix: "192.0.2.0/24", version: 4 },
          { prefix: "2001:db8::/32", version: 6 },
        ],
      },
      attribution: {
        rdapQueryUrl: "https://rdap.example.test/autnum/13335",
        routeViews: {
          provider: "RouteViews",
          queryUrl: "https://api.routeviews.org/asn/13335",
        },
      },
    });
    expect(requests).toStrictEqual([
      { url: "https://api.routeviews.org/asn/13335" },
    ]);
  });

  it("returns route data when RDAP registration lookup fails", async () => {
    const serviceLayer = layer(
      makeFetcher(() => ["192.0.2.0/24"]),
      makeRdapLayer(
        new ExternalProviderError({
          provider: "rdap-registry",
          operation: "lookup-asn",
          reason: "transport",
          retryable: true,
        })
      )
    );

    const response = await Effect.runPromise(
      lookupAsn(serviceLayer, "AS64496")
    );

    expect(response.holder).toMatchObject({
      _tag: "Unavailable",
      reason: "provider-failure",
    });
    expect(response.announcedPrefixes).toMatchObject({
      _tag: "Available",
      value: [{ prefix: "192.0.2.0/24", version: 4 }],
    });
    expect(response.attribution).not.toHaveProperty("rdapQueryUrl");
  });

  it("returns holder data when RouteViews is unavailable", async () => {
    const serviceLayer = layer(
      makeFetcher(
        () => [],
        [],
        () => true
      ),
      makeRdapLayer()
    );

    const response = await Effect.runPromise(
      lookupAsn(serviceLayer, "AS13335")
    );

    expect(response.holder).toMatchObject({
      _tag: "Available",
      value: "Cloudflare, Inc.",
    });
    expect(response.announcedPrefixes).toMatchObject({
      _tag: "Unavailable",
      reason: "provider-failure",
    });
  });

  it("rejects invalid ASN input before calling either provider", async () => {
    const requests: RouteViewsJsonRequest[] = [];

    const serviceLayer = layer(
      makeFetcher(() => [], requests),
      makeRdapLayer()
    );

    const result = await Effect.runPromise(
      Effect.result(lookupAsn(serviceLayer, "AS4294967295"))
    );

    expect(Result.isFailure(result)).toBeTruthy();
    expect(requests).toStrictEqual([]);
  });

  it("normalizes an IP into a host prefix and attributes observed BGP origins", async () => {
    const requests: RouteViewsJsonRequest[] = [];

    const serviceLayer = layer(
      makeFetcher(() => [routeObservation], requests),
      makeRdapLayer()
    );

    const response = await Effect.runPromise(
      lookupPrefix(serviceLayer, "192.0.2.1")
    );

    expect(
      Schema.decodeUnknownSync(PublicBgpPrefixLookupResponseSchema)(response)
    ).toStrictEqual(response);
    expect(response).toMatchObject({
      kind: "bgp-prefix",
      query: { prefix: "192.0.2.1/32", version: 4 },
      routes: [
        {
          prefix: { prefix: "192.0.2.0/24", version: 4 },
          originAsn: 13_335,
          rpkiState: "valid",
          reportingPeers: [
            {
              peerAsn: 6939,
              peerAddress: { address: "2001:db8::1", version: 6 },
              collector: "route-views6",
              asPath: "6939 13335 13335",
              communities: ["6939:100", "6939:200"],
              observedAt: "2026-10-27T12:30:00Z",
            },
          ],
        },
      ],
      attribution: {
        provider: "RouteViews",
        queryUrl: "https://api.routeviews.org/prefix/192.0.2.1/32",
      },
    });
    expect(requests).toStrictEqual([
      { url: "https://api.routeviews.org/prefix/192.0.2.1/32" },
    ]);
  });

  it("accepts a CIDR prefix and preserves a successful empty route result", async () => {
    const response = await Effect.runPromise(
      lookupPrefix(
        layer(
          makeFetcher(() => []),
          makeRdapLayer()
        ),
        "192.0.2.7/24"
      )
    );

    expect(response.query).toStrictEqual({
      prefix: "192.0.2.0/24",
      version: 4,
    });
    expect(response.routes).toStrictEqual([]);
  });

  it("rejects invalid prefix input without contacting RouteViews", async () => {
    const requests: RouteViewsJsonRequest[] = [];

    const serviceLayer = layer(
      makeFetcher(() => [], requests),
      makeRdapLayer()
    );

    const result = await Effect.runPromise(
      Effect.result(lookupPrefix(serviceLayer, "not-an-ip"))
    );

    expect(Result.isFailure(result)).toBeTruthy();
    expect(requests).toStrictEqual([]);
  });

  it("fails closed on malformed RouteViews observations", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        lookupPrefix(
          layer(
            makeFetcher(() => [{ ...routeObservation, origin_asn: -1 }]),
            makeRdapLayer()
          ),
          "192.0.2.0/24"
        )
      )
    );

    expect(Result.isFailure(result)).toBeTruthy();
  });
});
