import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { sanitizeRawCloudflareMetadata } from "./raw-cloudflare-metadata.ts";

const sanitize = async (
  cf: Partial<IncomingRequestCfProperties> | undefined,
  headers: HeadersInit = {},
  source:
    | "cloudflare-request"
    | "local-runtime"
    | "fixture" = "cloudflare-request"
) =>
  await Effect.runPromise(
    sanitizeRawCloudflareMetadata({
      cf,
      headers: new Headers(headers),
      source,
    })
  );

describe("safe raw Cloudflare metadata", () => {
  it("preserves original field names and values with provenance, units, and sensitivity", async () => {
    const metadata = await sanitize(
      {
        asn: 13_335,
        city: "Wellington",
        clientTcpRtt: 18,
        colo: "AKL",
      },
      {
        "cf-connecting-ip": "203.0.113.42",
        "cf-ray": "abc123-AKL",
      }
    );

    expect(metadata.asn).toStrictEqual({
      _tag: "Available",
      source: "cloudflare-request",
      value: 13_335,
      sensitivity: "public",
    });
    expect(metadata.clientTcpRtt).toStrictEqual({
      _tag: "Available",
      source: "cloudflare-request",
      value: 18,
      sensitivity: "personal",
      units: "ms",
    });
    expect(metadata.city).toMatchObject({
      _tag: "Available",
      source: "cloudflare-request",
      value: "Wellington",
      sensitivity: "personal",
    });
    expect(metadata["cf-connecting-ip"]).toMatchObject({
      _tag: "Available",
      value: "203.0.113.42",
      sensitivity: "personal",
    });
    expect(metadata["cf-ray"]).toMatchObject({
      _tag: "Available",
      value: "abc123-AKL",
    });
  });

  it("marks absent fields unavailable with an explicit reason and source", async () => {
    const metadata = await sanitize(undefined, {}, "local-runtime");

    expect(metadata.colo).toStrictEqual({
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
      sensitivity: "public",
    });
    expect(metadata["cf-connecting-ip"]).toStrictEqual({
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
      sensitivity: "personal",
    });
  });

  it("redacts cryptographic, fingerprint, bot, and custom host metadata values", async () => {
    const secret = "sensitive-canary-value";

    const cf: Partial<IncomingRequestCfProperties> = {
      botManagement: {
        corporateProxy: false,
        detectionIds: [12],
        ja3Hash: secret,
        score: 7,
        staticResource: false,
        verifiedBot: false,
      },
      hostMetadata: { apiKey: secret },
      tlsClientAuth: {
        certChainRFC9440: secret,
        certChainRFC9440TooLarge: false,
        certFingerprintSHA1: secret,
        certFingerprintSHA256: secret,
        certIssuerDN: "CN=Example CA",
        certIssuerDNRFC2253: "CN=Example CA",
        certIssuerDNLegacy: "CN=Example CA",
        certIssuerSKI: secret,
        certIssuerSerial: secret,
        certNotAfter: "Dec 22 19:39:00 2018 GMT",
        certNotBefore: "Dec 22 19:39:00 2018 GMT",
        certPresented: "1",
        certRFC9440: secret,
        certRFC9440TooLarge: false,
        certRevoked: "0",
        certSerial: secret,
        certSKI: secret,
        certSubjectDN: "CN=Example Client",
        certSubjectDNRFC2253: "CN=Example Client",
        certSubjectDNLegacy: "CN=Example Client",
        certVerified: "SUCCESS",
      },
      tlsExportedAuthenticator: {
        clientFinished: secret,
        clientHandshake: secret,
        serverFinished: secret,
        serverHandshake: secret,
      },
    };

    Object.defineProperty(cf, "clientTrustScore", {
      enumerable: true,
      value: 7,
    });

    const metadata = await sanitize(cf);

    for (const key of [
      "botManagement",
      "clientTrustScore",
      "hostMetadata",
      "tlsClientAuth",
      "tlsExportedAuthenticator",
    ]) {
      expect(metadata[key]).toMatchObject({
        _tag: "Unavailable",
        reason: "redacted",
        sensitivity: "sensitive",
      });
    }

    expect(JSON.stringify(metadata)).not.toContain(secret);
  });

  it("redacts unknown future Cloudflare fields until they receive an explicit policy", async () => {
    const secret = "future-field-canary";

    const metadata = await sanitize({
      future_edge_credential: secret,
      futureEdgeCredential: secret,
    });

    for (const key of ["futureEdgeCredential", "future_edge_credential"]) {
      expect(metadata[key]).toStrictEqual({
        _tag: "Unavailable",
        source: "cloudflare-request",
        reason: "redacted",
        sensitivity: "sensitive",
      });
    }

    expect(JSON.stringify(metadata)).not.toContain(secret);
  });

  it("rejects malformed safe fields without serializing nested input", async () => {
    const secret = "malformed-field-canary";
    const cf: Partial<IncomingRequestCfProperties> = {};

    Object.defineProperty(cf, "asn", {
      enumerable: true,
      value: { nested: secret },
    });
    Object.defineProperty(cf, "clientTcpRtt", { enumerable: true, value: -1 });

    const metadata = await sanitize(cf);

    expect(metadata.asn).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
    expect(metadata.clientTcpRtt).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
    expect(JSON.stringify(metadata)).not.toContain(secret);
  });

  it("never serializes arbitrary request headers", async () => {
    const secret = "header-secret-canary";

    const metadata = await sanitize(
      { colo: "AKL" },
      {
        authorization: secret,
        cookie: `session=${secret}`,
        "cf-ray": "abc123-AKL",
      }
    );

    const serialized = JSON.stringify(metadata);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("cookie");
    expect(metadata["cf-ray"]).toMatchObject({
      _tag: "Available",
      value: "abc123-AKL",
    });
  });

  it("keeps local request headers unavailable even when Cloudflare headers are supplied", async () => {
    const metadata = await sanitize(
      { colo: "AKL" },
      { "cf-connecting-ip": "203.0.113.8", "cf-ray": "spoofed" },
      "local-runtime"
    );

    expect(metadata["cf-connecting-ip"]).toMatchObject({
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
    });
    expect(metadata["cf-ray"]).toMatchObject({
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
    });
  });
});
