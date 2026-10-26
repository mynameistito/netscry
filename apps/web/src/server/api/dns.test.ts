import {
  ApiErrorResponseSchema,
  DnsLookupResponseSchema,
  ExternalProviderError,
} from "@netscry/schemas";
import type { DnsLookupResponse, DnsRecordType } from "@netscry/schemas";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { DnsService } from "../services/dns.ts";
import type { DnsServiceContract } from "../services/dns.ts";
// oxlint-disable sonarjs/no-hardcoded-ip -- These are parse-only API fixtures; the injected DNS service does not make network requests.
import { handleDnsLookup } from "./dns.ts";

const dnsResponse: DnsLookupResponse = Schema.decodeUnknownSync(
  DnsLookupResponseSchema
)({
  query: "example.com",
  recordType: "A",
  status: 0,
  truncated: false,
  dnssecAuthenticated: true,
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
  cacheTtlSeconds: 60,
  attribution: {
    resolver: "Cloudflare 1.1.1.1",
    resolverUrl: "https://cloudflare-dns.com/dns-query",
  },
});

const requestFor = (query: string, accept = "application/json") =>
  new Request(`https://netscry.example/api/v1/dns/${query}`, {
    headers: { accept },
  });

const makeServiceLayer = (lookup: DnsServiceContract["lookup"]) =>
  Layer.succeed(DnsService, { lookup });

describe("public DNS lookup API", () => {
  it("returns a schema-validated DNS response and public API headers", async () => {
    let receivedQuery: string | undefined;
    let receivedType: DnsRecordType | undefined;

    const response = await handleDnsLookup(
      requestFor("example.com", "application/json"),
      "  Example.com. ",
      makeServiceLayer((query, recordType) => {
        receivedQuery = query;
        receivedType = recordType;

        return Effect.succeed(dnsResponse);
      })
    );

    const body = Schema.decodeUnknownSync(DnsLookupResponseSchema)(
      await response.json()
    );

    expect({
      status: response.status,
      cacheControl: response.headers.get("cache-control"),
      contentType: response.headers.get("content-type"),
    }).toStrictEqual({
      status: 200,
      cacheControl: "no-store",
      contentType: "application/json; charset=utf-8",
    });
    expect(body).toStrictEqual(dnsResponse);
    expect(receivedQuery).toBe("Example.com.");
    expect(receivedType).toBe("A");
  });

  it.each([
    "a",
    "AAAA",
    "CAA",
    "CNAME",
    "MX",
    "NS",
    "PTR",
    "SOA",
    "SRV",
    "TXT",
  ])("accepts the %s record type query parameter", async (recordType) => {
    let receivedType: DnsRecordType | undefined;

    const response = await handleDnsLookup(
      new Request(
        `https://netscry.example/api/v1/dns/example.com?type=${recordType}`
      ),
      "example.com",
      makeServiceLayer((_query, selectedType) => {
        receivedType = selectedType;

        return Effect.succeed({ ...dnsResponse, recordType: selectedType });
      })
    );

    expect(response.status).toBe(200);
    expect(receivedType).toBe(recordType.toUpperCase());
  });

  it("allows PTR lookup using an IP address", async () => {
    let receivedQuery: string | undefined;
    let receivedType: DnsRecordType | undefined;

    const response = await handleDnsLookup(
      new Request("https://netscry.example/api/v1/dns/192.0.2.10?type=PTR"),
      "192.0.2.10",
      makeServiceLayer((query, recordType) => {
        receivedQuery = query;
        receivedType = recordType;

        return Effect.succeed({ ...dnsResponse, recordType: "PTR" });
      })
    );

    expect(response.status).toBe(200);
    expect(receivedQuery).toBe("192.0.2.10");
    expect(receivedType).toBe("PTR");
  });

  it.each([
    ["empty", ""],
    ["invalid", "https://example.com"],
    ["oversized", "x".repeat(255)],
  ])(
    "rejects %s queries before starting resolver work",
    async (_name, query) => {
      let lookups = 0;

      const response = await handleDnsLookup(
        requestFor("invalid"),
        query,
        makeServiceLayer(() => {
          lookups += 1;

          return Effect.succeed(dnsResponse);
        })
      );

      const error = Schema.decodeUnknownSync(ApiErrorResponseSchema)(
        await response.json()
      );

      expect(response.status).toBe(400);
      expect(error.error.code).toBe("invalid-input");
      expect(lookups).toBe(0);
    }
  );

  it.each([
    ["unsupported", "DNSKEY"],
    ["repeated", "A&type=AAAA"],
  ])(
    "rejects %s record type parameters before resolver work",
    async (_name, query) => {
      let lookups = 0;

      const response = await handleDnsLookup(
        new Request(
          `https://netscry.example/api/v1/dns/example.com?type=${query}`
        ),
        "example.com",
        makeServiceLayer(() => {
          lookups += 1;

          return Effect.succeed(dnsResponse);
        })
      );

      expect(response.status).toBe(400);
      expect(lookups).toBe(0);
    }
  );

  it("honors unsupported Accept values without resolver work", async () => {
    let lookups = 0;

    const response = await handleDnsLookup(
      requestFor("example.com", "text/plain"),
      "example.com",
      makeServiceLayer(() => {
        lookups += 1;

        return Effect.succeed(dnsResponse);
      })
    );

    expect(response.status).toBe(406);
    expect(lookups).toBe(0);
  });

  it("returns a safe typed error when the resolver fails", async () => {
    const response = await handleDnsLookup(
      requestFor("example.com"),
      "example.com",
      makeServiceLayer(() =>
        Effect.fail(
          new ExternalProviderError({
            provider: "cloudflare-doh",
            operation: "dns-lookup",
            reason: "http-status",
            status: 503,
            retryable: true,
          })
        )
      )
    );

    const error = Schema.decodeUnknownSync(ApiErrorResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(500);
    expect(error.error.code).toBe("internal-error");
    expect(JSON.stringify(error)).not.toContain("cloudflare-doh");
  });
});
