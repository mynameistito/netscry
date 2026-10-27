import {
  ApiErrorResponseSchema,
  ExternalProviderError,
  PublicAsnLookupResponseSchema,
  PublicBgpPrefixLookupResponseSchema,
} from "@netscry/schemas";
import type {
  PublicAsnLookupResponse,
  PublicBgpPrefixLookupResponse,
} from "@netscry/schemas";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { AsnBgpService } from "../services/asn-bgp.ts";
import type { AsnBgpServiceContract } from "../services/asn-bgp.ts";
import { handleAsnLookup, handleBgpPrefixQuery } from "./asn-bgp.ts";

const asnResponse: PublicAsnLookupResponse = Schema.decodeUnknownSync(
  PublicAsnLookupResponseSchema
)({
  kind: "asn",
  asn: 13_335,
  holder: {
    _tag: "Available",
    source: "third-party",
    value: "Cloudflare, Inc.",
    sensitivity: "public",
  },
  announcedPrefixes: {
    _tag: "Available",
    source: "third-party",
    value: [{ prefix: "192.0.2.0/24", version: 4 }],
    sensitivity: "public",
  },
  attribution: {
    rdapQueryUrl: "https://rdap.example.test/autnum/13335",
    routeViews: {
      provider: "RouteViews",
      queryUrl: "https://api.routeviews.org/guest/asn/13335",
      coverage:
        "Observed by a subset of RouteViews collectors; this is not a complete global routing view.",
    },
  },
});

const bgpResponse: PublicBgpPrefixLookupResponse = Schema.decodeUnknownSync(
  PublicBgpPrefixLookupResponseSchema
)({
  kind: "bgp-prefix",
  query: { prefix: "192.0.2.1/32", version: 4 },
  routes: [
    {
      prefix: { prefix: "192.0.2.0/24", version: 4 },
      originAsn: 13_335,
      rpkiState: "valid",
      reportingPeers: [],
    },
  ],
  attribution: {
    provider: "RouteViews",
    queryUrl: "https://api.routeviews.org/guest/prefix/192.0.2.1/32",
    coverage:
      "Observed by a subset of RouteViews collectors; this is not a complete global routing view.",
  },
});

const makeServiceLayer = (service: Partial<AsnBgpServiceContract> = {}) =>
  Layer.succeed(
    AsnBgpService,
    AsnBgpService.of({
      lookupAsn: service.lookupAsn ?? (() => Effect.succeed(asnResponse)),
      lookupPrefix: service.lookupPrefix ?? (() => Effect.succeed(bgpResponse)),
    })
  );

const asnRequest = (asn: string, accept = "application/json") =>
  new Request(`https://netscry.example/api/v1/asn/${asn}`, {
    headers: { accept },
  });

const bgpRequest = (query: string, accept = "application/json") =>
  new Request(
    `https://netscry.example/api/v1/bgp?prefix=${encodeURIComponent(query)}`,
    { headers: { accept } }
  );

describe("public ASN and BGP lookup API", () => {
  it("returns schema-validated ASN data with attribution and API headers", async () => {
    let receivedAsn: string | undefined;

    const response = await handleAsnLookup(
      asnRequest("AS013335"),
      " AS013335 ",
      makeServiceLayer({
        lookupAsn: (input) => {
          receivedAsn = input;

          return Effect.succeed(asnResponse);
        },
      })
    );

    const body = Schema.decodeUnknownSync(PublicAsnLookupResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    expect(body).toStrictEqual(asnResponse);
    expect(receivedAsn).toBe("AS013335");
  });

  it.each(["", "0", "4294967295", "not-an-asn", "x".repeat(17)])(
    "rejects invalid ASN input %j before service work",
    async (input) => {
      let calls = 0;

      const response = await handleAsnLookup(
        asnRequest("invalid"),
        input,
        makeServiceLayer({
          lookupAsn: () => {
            calls += 1;

            return Effect.succeed(asnResponse);
          },
        })
      );

      const body = Schema.decodeUnknownSync(ApiErrorResponseSchema)(
        await response.json()
      );

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("invalid-input");
      expect(calls).toBe(0);
    }
  );

  it("returns RouteViews origin results for an IPv4 query", async () => {
    let receivedPrefix: string | undefined;

    const response = await handleBgpPrefixQuery(
      bgpRequest("192.0.2.1"),
      makeServiceLayer({
        lookupPrefix: (input) => {
          receivedPrefix = input;

          return Effect.succeed(bgpResponse);
        },
      })
    );

    const body = Schema.decodeUnknownSync(PublicBgpPrefixLookupResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(body).toStrictEqual(bgpResponse);
    expect(receivedPrefix).toBe("192.0.2.1");
  });

  it("preserves partial ASN source availability", async () => {
    const partialResponse: PublicAsnLookupResponse = {
      ...asnResponse,
      holder: {
        _tag: "Unavailable",
        source: "third-party",
        reason: "provider-failure",
        sensitivity: "public",
      },
    };

    const serviceLayer = makeServiceLayer({
      lookupAsn: () => Effect.succeed(partialResponse),
    });

    const response = await handleAsnLookup(
      asnRequest("13335"),
      "13335",
      serviceLayer
    );

    const body = Schema.decodeUnknownSync(PublicAsnLookupResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(body.holder._tag).toBe("Unavailable");
    expect(body.announcedPrefixes._tag).toBe("Available");
  });

  it("accepts an IPv6 CIDR BGP query", async () => {
    const prefixResponse: PublicBgpPrefixLookupResponse = {
      ...bgpResponse,
      query: { prefix: "2001:db8::/32", version: 6 },
      attribution: {
        ...bgpResponse.attribution,
        queryUrl: "https://api.routeviews.org/guest/prefix/2001:db8::/32",
      },
    };

    let receivedPrefix: string | undefined;

    const response = await handleBgpPrefixQuery(
      bgpRequest("2001:db8::/32"),
      makeServiceLayer({
        lookupPrefix: (input) => {
          receivedPrefix = input;

          return Effect.succeed(prefixResponse);
        },
      })
    );

    const body = Schema.decodeUnknownSync(PublicBgpPrefixLookupResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(body.query).toStrictEqual({ prefix: "2001:db8::/32", version: 6 });
    expect(receivedPrefix).toBe("2001:db8::/32");
  });

  it.each([
    ["missing", "https://netscry.example/api/v1/bgp"],
    [
      "repeated",
      "https://netscry.example/api/v1/bgp?prefix=192.0.2.1&prefix=192.0.2.2",
    ],
    ["invalid", "https://netscry.example/api/v1/bgp?prefix=bad"],
    [
      "oversized",
      `https://netscry.example/api/v1/bgp?prefix=${"x".repeat(129)}`,
    ],
  ])("rejects %s BGP queries before service work", async (_name, url) => {
    let calls = 0;

    const response = await handleBgpPrefixQuery(
      new Request(url),
      makeServiceLayer({
        lookupPrefix: () => {
          calls += 1;

          return Effect.succeed(bgpResponse);
        },
      })
    );

    const body = Schema.decodeUnknownSync(ApiErrorResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid-input");
    expect(calls).toBe(0);
  });

  it("returns a safe error for unsupported response representations", async () => {
    const response = await handleAsnLookup(
      asnRequest("13335", "text/html"),
      "13335",
      makeServiceLayer()
    );

    expect(response.status).toBe(406);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
  });

  it("does not expose provider error details", async () => {
    const response = await handleAsnLookup(
      asnRequest("13335"),
      "13335",
      makeServiceLayer({
        lookupAsn: () =>
          Effect.fail(
            new ExternalProviderError({
              provider: "private-upstream-name",
              operation: "internal-lookup",
              reason: "transport",
              retryable: false,
            })
          ),
      })
    );

    const body = Schema.decodeUnknownSync(ApiErrorResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("private-upstream-name");
    expect(JSON.stringify(body)).not.toContain("internal-lookup");
  });
});
