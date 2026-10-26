import {
  ExternalProviderError,
  RdapBootstrapRegistrySchema,
  RdapNormalizedRecordSchema,
} from "@netscry/schemas";
import type { Layer } from "effect";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { RdapLookupTarget } from "./rdap-bootstrap.ts";
import { RdapService, layer } from "./rdap.ts";
import type { RdapJsonFetcher, RdapJsonRequest } from "./rdap.ts";

const registry = Schema.decodeUnknownSync(RdapBootstrapRegistrySchema)({
  version: "1.0",
  publication: "2026-10-22T23:00:04Z",
  services: [[["192.0.2.0/24"], ["https://rdap.example.test/rdap/"]]],
});

const responses = (request: RdapJsonRequest): Schema.Json => {
  if (request.provider === "iana-rdap-bootstrap") {
    if (request.url.endsWith("/asn.json")) {
      return {
        ...registry,
        services: [[["13335-13336"], ["https://rdap.example.test/"]]],
      };
    }

    if (request.url.endsWith("/dns.json")) {
      return {
        ...registry,
        services: [[["com"], ["https://rdap.example.test/"]]],
      };
    }

    return registry;
  }

  if (request.url.includes("/autnum/")) {
    return {
      handle: "AS13335",
      name: "Example Network",
      startAutnum: 13_335,
      endAutnum: 13_336,
      entities: [{ handle: "EXAMPLE-ABUSE", roles: ["abuse"] }],
    };
  }

  if (request.url.includes("/domain/")) {
    return {
      handle: "EXAMPLE-COM",
      ldhName: "EXAMPLE.com",
      unicodeName: "example.com",
      status: ["active"],
      nameservers: [{ ldhName: "NS1.EXAMPLE.COM" }],
    };
  }

  return {
    handle: "NET-192-0-2-0-1",
    name: "Documentation Network",
    type: "ALLOCATED PORTABLE",
    country: "ZZ",
    ipVersion: "v4",
    startAddress: "192.0.2.0",
    endAddress: "192.0.2.255",
    status: ["active"],
    events: [
      { eventAction: "last changed", eventDate: "2025-01-02T03:04:05Z" },
    ],
    entities: [
      {
        handle: "EXAMPLE-ABUSE",
        roles: ["abuse"],
        vcardArray: [
          "vcard",
          [
            ["fn", {}, "text", "Example Abuse Desk"],
            ["email", {}, "text", ["abuse@example.test"]],
            ["tel", {}, "text", "+1-555-0100"],
          ],
        ],
      },
    ],
  };
};

const makeFetcher =
  (
    respond: (request: RdapJsonRequest) => Schema.Json = responses,
    requests: RdapJsonRequest[] = [],
    shouldFail: (request: RdapJsonRequest) => boolean = () => false
  ): RdapJsonFetcher =>
  (request, schema) => {
    requests.push(request);

    if (shouldFail(request)) {
      return Effect.fail(
        new ExternalProviderError({
          provider: request.provider,
          operation: request.operation,
          reason: "transport",
          retryable: true,
        })
      );
    }

    return Schema.decodeUnknownEffect(schema)(respond(request)).pipe(
      Effect.mapError(
        () =>
          new ExternalProviderError({
            provider: request.provider,
            operation: request.operation,
            reason: "invalid-response",
            retryable: false,
          })
      )
    );
  };

const lookup = (
  serviceLayer: Layer.Layer<RdapService>,
  target: RdapLookupTarget
) =>
  Effect.gen(function* runLookup() {
    const service = yield* RdapService;

    return yield* service.lookup(target);
  }).pipe(Effect.provide(serviceLayer));

describe(RdapService, () => {
  it("fetches, normalizes, validates, and attributes an IP allocation record", async () => {
    const record = await Effect.runPromise(
      lookup(layer(makeFetcher()), { kind: "ip", address: "192.0.2.7" })
    );

    expect(
      Schema.decodeUnknownSync(RdapNormalizedRecordSchema)(record)
    ).toStrictEqual(record);
    expect(record).toMatchObject({
      kind: "ip",
      query: "192.0.2.7",
      data: {
        handle: "NET-192-0-2-0-1",
        name: "Documentation Network",
        startAddress: "192.0.2.0",
        endAddress: "192.0.2.255",
        country: "ZZ",
        statuses: ["active"],
        events: [{ action: "last changed", date: "2025-01-02T03:04:05Z" }],
        entities: [
          {
            handle: "EXAMPLE-ABUSE",
            roles: ["abuse"],
            name: "Example Abuse Desk",
            emails: ["abuse@example.test"],
            phones: ["+1-555-0100"],
          },
        ],
      },
      attribution: {
        source: "third-party",
        registryUrl: "https://data.iana.org/rdap/ipv4.json",
        serviceUrl: "https://rdap.example.test/rdap/",
        queryUrl: "https://rdap.example.test/rdap/ip/192.0.2.7",
        matchedEntry: "192.0.2.0/24",
      },
    });
    expect(record.raw).toHaveProperty("startAddress", "192.0.2.0");
  });

  it("selects the ASN and domain bootstrap registries and normalizes their records", async () => {
    const serviceLayer = layer(makeFetcher());

    const asn = await Effect.runPromise(
      lookup(serviceLayer, { kind: "asn", asn: "AS13335" })
    );

    const domain = await Effect.runPromise(
      lookup(serviceLayer, { kind: "domain", domain: "WWW.example.com" })
    );

    expect(asn).toMatchObject({
      kind: "asn",
      data: { handle: "AS13335", name: "Example Network", startAutnum: 13_335 },
      attribution: { registryUrl: "https://data.iana.org/rdap/asn.json" },
    });
    expect(domain).toMatchObject({
      kind: "domain",
      query: "www.example.com",
      data: {
        handle: "EXAMPLE-COM",
        ldhName: "EXAMPLE.com",
        nameservers: ["ns1.example.com"],
      },
      attribution: { registryUrl: "https://data.iana.org/rdap/dns.json" },
    });
  });

  it("caches successful IANA bootstrap documents across lookups", async () => {
    const requests: RdapJsonRequest[] = [];

    const program = Effect.gen(function* runRepeatedLookups() {
      const service = yield* RdapService;
      yield* service.lookup({ kind: "ip", address: "192.0.2.7" });
      yield* service.lookup({ kind: "ip", address: "192.0.2.8" });
    }).pipe(Effect.provide(layer(makeFetcher(responses, requests))));

    await Effect.runPromise(program);

    expect(
      requests.filter((request) => request.provider === "iana-rdap-bootstrap")
    ).toHaveLength(1);
  });

  it("refreshes IANA bootstrap documents after 24 hours", async () => {
    const requests: RdapJsonRequest[] = [];
    const fetcher = makeFetcher(responses, requests);
    const serviceLayer = layer(fetcher);
    const now = Date.now();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      await Effect.runPromise(
        lookup(serviceLayer, { kind: "ip", address: "192.0.2.7" })
      );

      dateNow.mockReturnValue(now + 24 * 60 * 60 * 1000 + 1);

      await Effect.runPromise(
        lookup(serviceLayer, { kind: "ip", address: "192.0.2.8" })
      );
    } finally {
      dateNow.mockRestore();
    }

    expect(
      requests.filter((request) => request.provider === "iana-rdap-bootstrap")
    ).toHaveLength(2);
  });

  it("does not cache a failed IANA bootstrap request", async () => {
    const requests: RdapJsonRequest[] = [];
    let bootstrapAttempts = 0;

    const fetcher = makeFetcher(responses, requests, (request) => {
      if (request.provider !== "iana-rdap-bootstrap") {
        return false;
      }

      bootstrapAttempts += 1;

      return bootstrapAttempts === 1;
    });

    const program = Effect.gen(function* retryBootstrap() {
      const service = yield* RdapService;

      const first = yield* Effect.result(
        service.lookup({ kind: "ip", address: "192.0.2.7" })
      );

      const second = yield* Effect.result(
        service.lookup({ kind: "ip", address: "192.0.2.7" })
      );

      return [first, second] as const;
    }).pipe(Effect.provide(layer(fetcher)));

    const [first, second] = await Effect.runPromise(program);

    expect(first._tag).toBe("Failure");
    expect(second._tag).toBe("Success");
    expect(bootstrapAttempts).toBe(2);
  });

  it("tries the next secure RDAP base after a provider failure", async () => {
    const requests: RdapJsonRequest[] = [];

    const fetcher = makeFetcher(
      (request) =>
        request.provider === "iana-rdap-bootstrap"
          ? {
              ...registry,
              services: [
                [
                  ["192.0.2.0/24"],
                  [
                    "https://first.example.test/",
                    "https://second.example.test/",
                  ],
                ],
              ],
            }
          : responses(request),
      requests,
      (request) => request.origin === "https://first.example.test"
    );

    const record = await Effect.runPromise(
      lookup(layer(fetcher), { kind: "ip", address: "192.0.2.7" })
    );

    expect(record.attribution.serviceUrl).toBe("https://second.example.test/");
    expect(
      requests.filter((request) => request.provider === "rdap-registry")
    ).toHaveLength(2);
  });

  it("returns a safe error for malformed lookup input without making a request", async () => {
    const requests: RdapJsonRequest[] = [];

    const result = await Effect.runPromise(
      Effect.gen(function* readFailure() {
        const service = yield* RdapService;

        return yield* Effect.result(
          service.lookup({ kind: "asn", asn: "AS0" })
        );
      }).pipe(Effect.provide(layer(makeFetcher(responses, requests))))
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { reason: "invalid-request", provider: "iana-rdap" },
    });
    expect(requests).toHaveLength(0);
  });

  it("rejects a non-object upstream RDAP response with a typed safe failure", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* readInvalidRecord() {
        const service = yield* RdapService;

        return yield* Effect.result(
          service.lookup({ kind: "ip", address: "192.0.2.7" })
        );
      }).pipe(
        Effect.provide(
          layer(
            makeFetcher((request) =>
              request.provider === "rdap-registry" ? null : responses(request)
            )
          )
        )
      )
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      failure: {
        _tag: "ExternalProviderError",
        provider: "rdap-registry",
        reason: "invalid-response",
        retryable: false,
      },
    });
  });
});
