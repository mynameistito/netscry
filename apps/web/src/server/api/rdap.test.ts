import {
  ApiErrorResponseSchema,
  ExternalProviderError,
  RdapNormalizedRecordSchema,
} from "@netscry/schemas";
import type { RdapNormalizedRecord } from "@netscry/schemas";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

import type { RdapLookupTarget } from "../services/rdap-bootstrap.ts";
import { RdapService } from "../services/rdap.ts";
// oxlint-disable sonarjs/no-hardcoded-ip -- These are parse-only API fixtures; the injected RDAP service never sends network requests.
import { handleRdapDomainLookup, handleRdapIpLookup } from "./rdap.ts";

const record: RdapNormalizedRecord = Schema.decodeUnknownSync(
  RdapNormalizedRecordSchema
)({
  kind: "ip",
  query: "192.0.2.7",
  data: {
    handle: "NET-192-0-2-0-1",
    startAddress: "192.0.2.0",
    endAddress: "192.0.2.255",
    statuses: ["active"],
    events: [],
    nameservers: [],
    entities: [],
  },
  attribution: {
    source: "third-party",
    registryUrl: "https://data.iana.org/rdap/ipv4.json",
    registryPublication: "2026-10-22T23:00:04Z",
    serviceUrl: "https://rdap.example.test/",
    queryUrl: "https://rdap.example.test/ip/192.0.2.7",
    matchedEntry: "192.0.2.0/24",
  },
  raw: { startAddress: "192.0.2.0", endAddress: "192.0.2.255" },
});

const requestFor = (path: string, accept = "application/json") =>
  new Request(`https://netscry.example${path}`, { headers: { accept } });

const makeServiceLayer = (
  lookup: (
    target: RdapLookupTarget
  ) => Effect.Effect<RdapNormalizedRecord, ExternalProviderError>
) => Layer.succeed(RdapService, { lookup });

describe("public RDAP lookup API", () => {
  it("returns a schema-validated IP record with public API headers", async () => {
    const response = await handleRdapIpLookup(
      requestFor("/api/v1/rdap/ip/192.0.2.7"),
      "192.0.2.7",
      makeServiceLayer(() => Effect.succeed(record))
    );

    const body = Schema.decodeUnknownSync(RdapNormalizedRecordSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toStrictEqual(record);
  });

  it("accepts a syntactically valid CIDR for an IP RDAP lookup", async () => {
    let receivedTarget: RdapLookupTarget | undefined;

    const response = await handleRdapIpLookup(
      requestFor("/api/v1/rdap/ip/192.0.2.7%2F24"),
      "192.0.2.7/24",
      makeServiceLayer((target) => {
        receivedTarget = target;

        return Effect.succeed(record);
      })
    );

    expect(response.status).toBe(200);
    expect(receivedTarget).toStrictEqual({
      kind: "ip",
      address: "192.0.2.7/24",
    });
  });

  it("passes a trimmed IDN domain lookup to the service", async () => {
    let receivedTarget: RdapLookupTarget | undefined;

    const response = await handleRdapDomainLookup(
      requestFor("/api/v1/rdap/domain/b%C3%BCcher.example"),
      "  bücher.example. ",
      makeServiceLayer((target) => {
        receivedTarget = target;

        return Effect.succeed({
          ...record,
          kind: "domain",
          query: "xn--bcher-kva.example",
        });
      })
    );

    expect(response.status).toBe(200);
    expect(receivedTarget).toStrictEqual({
      kind: "domain",
      domain: "bücher.example.",
    });
  });

  it.each([
    ["IP", "", handleRdapIpLookup],
    ["IP", "not-an-ip", handleRdapIpLookup],
    ["domain", "not a domain", handleRdapDomainLookup],
    ["domain", "x".repeat(255), handleRdapDomainLookup],
  ])(
    "returns invalid-input for malformed %s lookup values",
    async (_kind, input, handler) => {
      let lookups = 0;

      const response = await handler(
        requestFor("/api/v1/rdap/invalid"),
        input,
        makeServiceLayer(() => {
          lookups += 1;

          return Effect.succeed(record);
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

  it("honors unsupported Accept values without starting the lookup", async () => {
    let lookups = 0;

    const response = await handleRdapIpLookup(
      requestFor("/api/v1/rdap/ip/192.0.2.7", "text/plain"),
      "192.0.2.7",
      makeServiceLayer(() => {
        lookups += 1;

        return Effect.succeed(record);
      })
    );

    expect(response.status).toBe(406);
    expect(lookups).toBe(0);
  });

  it("returns a safe typed API error for provider failures", async () => {
    const response = await handleRdapDomainLookup(
      requestFor("/api/v1/rdap/domain/example.com"),
      "example.com",
      makeServiceLayer(() =>
        Effect.fail(
          new ExternalProviderError({
            provider: "rdap-registry",
            operation: "fetch-domain",
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
    expect(error.error).toStrictEqual({
      code: "internal-error",
      message: "The request could not be completed.",
    });
    expect(JSON.stringify(error)).not.toContain("rdap-registry");
  });
});
