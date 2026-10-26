import type { Result } from "@netscry/core";
// oxlint-disable sonarjs/no-hardcoded-ip -- These are parse-only registry fixtures and never network destinations.
import { RdapBootstrapRegistrySchema } from "@netscry/schemas";
import type { RdapBootstrapRegistry } from "@netscry/schemas";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  buildRdapQueryUrl,
  discoverRdapService,
  parseRdapLookupTarget,
} from "./rdap-bootstrap.ts";

const makeRegistry = (
  services: readonly (readonly [readonly string[], readonly string[]])[]
): RdapBootstrapRegistry =>
  Schema.decodeUnknownSync(RdapBootstrapRegistrySchema)({
    version: "1.0",
    publication: "2026-10-22T23:00:04Z",
    services,
  });

const unwrapOk = <Value, Failure>(result: Result<Value, Failure>): Value => {
  if (result._tag === "Err") {
    throw new Error("Expected a successful RDAP bootstrap result");
  }

  return result.value;
};

const unwrapErr = <Value, Failure>(result: Result<Value, Failure>): Failure => {
  if (result._tag === "Ok") {
    throw new Error("Expected a failed RDAP bootstrap result");
  }

  return result.error;
};

describe("RDAP bootstrap discovery", () => {
  it("decodes the RFC 9224 nested service-array contract", () => {
    const decoded = makeRegistry([[["com"], ["https://rdap.example.test/"]]]);

    expect(decoded.services).toStrictEqual([
      [["com"], ["https://rdap.example.test/"]],
    ]);
  });

  it("selects the longest matching IPv4 prefix and prefers HTTPS URLs", () => {
    const result = discoverRdapService(
      makeRegistry([
        [
          ["192.0.0.0/8"],
          ["http://broad.example.test/", "https://broad.example.test/rdap/"],
        ],
        [
          ["192.0.2.0/24"],
          [
            "http://specific.example.test/",
            "https://specific.example.test/rdap/",
          ],
        ],
      ]),
      { kind: "ip", address: "192.0.2.129" }
    );

    expect(unwrapOk(result)).toMatchObject({
      match: "192.0.2.0/24",
      baseUrls: ["https://specific.example.test/rdap/"],
    });
  });

  it("matches IPv6 prefixes by address family and longest prefix", () => {
    const result = discoverRdapService(
      makeRegistry([
        [["2001:db8::/32"], ["https://broad.example.test/rdap/"]],
        [["2001:db8:1234::/48"], ["https://specific.example.test/rdap/"]],
        [["192.0.2.0/24"], ["https://wrong-family.example.test/rdap/"]],
      ]),
      { kind: "ip", address: "2001:db8:1234::abcd" }
    );

    expect(unwrapOk(result).match).toBe("2001:db8:1234::/48");
  });

  it("reports the most-specific prefix within a single service", () => {
    const result = discoverRdapService(
      makeRegistry([
        [["192.0.0.0/8", "192.0.2.0/24"], ["https://rdap.example.test/"]],
      ]),
      { kind: "ip", address: "192.0.2.129" }
    );

    expect(unwrapOk(result).match).toBe("192.0.2.0/24");
  });

  it("uses the inclusive ASN bootstrap range", () => {
    const result = discoverRdapService(
      makeRegistry([[["13334-13336"], ["https://asn.example.test/rdap/"]]]),
      { kind: "asn", asn: "AS13336" }
    );

    expect(unwrapOk(result)).toMatchObject({
      match: "13334-13336",
      target: { kind: "asn", asn: { value: 13_336, canonical: "AS13336" } },
    });
  });

  it("matches domains on label boundaries and chooses the longest suffix", () => {
    const registry = makeRegistry([
      [["com"], ["https://com.example.test/rdap/"]],
      [["example.com"], ["https://example.example.test/rdap/"]],
    ]);

    const result = discoverRdapService(registry, {
      kind: "domain",
      domain: "www.example.com",
    });

    const boundaryResult = discoverRdapService(registry, {
      kind: "domain",
      domain: "goodexample.com",
    });

    expect(unwrapOk(result).match).toBe("example.com");
    expect(unwrapOk(boundaryResult).match).toBe("com");
  });

  it("uses the root entry when no domain suffix is registered", () => {
    const result = discoverRdapService(
      makeRegistry([[[""], ["https://root.example.test/rdap/"]]]),
      { kind: "domain", domain: "unregistered" }
    );

    expect(unwrapOk(result)).toMatchObject({
      match: "",
      baseUrls: ["https://root.example.test/rdap/"],
    });
  });

  it("normalizes internationalized domain names before matching", () => {
    const result = discoverRdapService(
      makeRegistry([[["example"], ["https://domains.example.test/rdap/"]]]),
      { kind: "domain", domain: "bücher.example" }
    );

    expect(unwrapOk(result).target).toMatchObject({
      kind: "domain",
      domain: "xn--bcher-kva.example",
    });
  });

  it("does not fall back to insecure or local RDAP service URLs", () => {
    const result = discoverRdapService(
      makeRegistry([
        [["com"], ["http://rdap.example.test/", "https://localhost/rdap/"]],
      ]),
      { kind: "domain", domain: "example.com" }
    );

    expect(unwrapErr(result)).toStrictEqual({
      _tag: "NoSecureRdapServiceUrl",
    });
  });

  it("constructs RFC 9082 IP, CIDR, ASN, and domain query paths", () => {
    const targets = [
      {
        kind: "ip" as const,
        address: "2001:0db8::1",
        prefixLength: 64,
      },
      { kind: "ip" as const, address: "192.0.2.129/24" },
      { kind: "asn" as const, asn: "AS13335" },
      { kind: "domain" as const, domain: "BÜCHER.example." },
    ];

    const urls = targets.map((target, index) => {
      const baseUrl =
        index === 0
          ? "https://rdap.example.test/registry/"
          : "https://rdap.example.test/";

      return unwrapOk(buildRdapQueryUrl(baseUrl, target)).href;
    });

    expect(urls).toStrictEqual([
      "https://rdap.example.test/registry/ip/2001:db8::1/64",
      "https://rdap.example.test/ip/192.0.2.0/24",
      "https://rdap.example.test/autnum/13335",
      "https://rdap.example.test/domain/xn--bcher-kva.example",
    ]);
  });

  it("rejects malformed targets and unsafe or unmatched bases as values", () => {
    const invalidTarget = parseRdapLookupTarget({ kind: "asn", asn: "AS0" });

    const noMatch = discoverRdapService(
      makeRegistry([[["com"], ["https://rdap.example.test/"]]]),
      { kind: "ip", address: "192.0.2.1" }
    );

    expect(unwrapErr(invalidTarget)).toStrictEqual({
      _tag: "InvalidRdapLookupTarget",
    });
    expect(unwrapErr(noMatch)).toStrictEqual({
      _tag: "RdapServiceNotFound",
    });
    expect(
      unwrapErr(
        buildRdapQueryUrl("http://rdap.example.test/", {
          kind: "domain",
          domain: "example.com",
        })
      )
    ).toStrictEqual({ _tag: "InvalidRdapBaseUrl" });
  });
});
