import type { Layer } from "effect";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  layerFixture,
  layerLive,
  layerLocal,
  VisitorMetadataService,
} from "./visitor-metadata.ts";
import type {
  CloudflareVisitorProperties,
  VisitorMetadataRequest,
} from "./visitor-metadata.ts";

const requestWithMetadata = (
  headers: HeadersInit = {},
  cf?: CloudflareVisitorProperties
): VisitorMetadataRequest => ({ headers: new Headers(headers), cf });

const readMetadata = async (
  layer: Layer.Layer<VisitorMetadataService>,
  request: VisitorMetadataRequest
) =>
  await Effect.runPromise(
    Effect.gen(function* getMetadata() {
      const service = yield* VisitorMetadataService;

      return yield* service.read(request);
    }).pipe(Effect.provide(layer))
  );

const cfMetadata = {
  asn: 13_335,
  asOrganization: "Cloudflare, Inc.",
  colo: "AKL",
  continent: "OC",
  country: "NZ",
  region: "Wellington Region",
  regionCode: "WGN",
  city: "Wellington",
  postalCode: "6011",
  latitude: "-41.2865",
  longitude: "174.7762",
  timezone: "Pacific/Auckland",
  isEUCountry: "1",
  httpProtocol: "HTTP/3",
  tlsVersion: "TLSv1.3",
  tlsCipher: "TLS_AES_128_GCM_SHA256",
  clientAcceptEncoding: "gzip, br",
  clientTcpRtt: 18,
  botManagement: { score: 7, verifiedBot: false, ja3Hash: "example-ja3" },
  tlsClientAuth: { certPresented: "1" },
} satisfies CloudflareVisitorProperties;

describe(VisitorMetadataService, () => {
  it("reads fast-path identity and location fields with source labels", async () => {
    const request = requestWithMetadata(
      { "cf-connecting-ip": "2001:db8::1" },
      cfMetadata
    );

    const effect = Effect.gen(function* readFastPaths() {
      const service = yield* VisitorMetadataService;

      return yield* Effect.all([
        service.readIp(request),
        service.readAsn(request),
        service.readAsOrganization(request),
        service.readCountry(request),
        service.readColo(request),
      ]);
    }).pipe(Effect.provide(layerLive));

    const [ip, asn, asOrganization, country, colo] =
      await Effect.runPromise(effect);

    expect(ip).toStrictEqual({
      _tag: "Available",
      source: "cloudflare-request",
      value: { address: "2001:db8::1", version: 6 },
      sensitivity: "personal",
    });
    expect(asn).toMatchObject({
      _tag: "Available",
      source: "cloudflare-request",
      value: 13_335,
    });
    expect(asOrganization).toMatchObject({
      _tag: "Available",
      source: "cloudflare-request",
      value: "Cloudflare, Inc.",
    });
    expect(country).toMatchObject({
      _tag: "Available",
      source: "cloudflare-request",
      value: "NZ",
    });
    expect(colo).toMatchObject({
      _tag: "Available",
      source: "cloudflare-request",
      value: "AKL",
    });
  });

  it("does not trust Cloudflare-looking headers for the local IP fast path", async () => {
    const request = requestWithMetadata(
      {
        "cf-connecting-ip": "198.51.100.5",
        "x-forwarded-for": "192.0.2.9",
      },
      cfMetadata
    );

    const effect = Effect.gen(function* readLocalIp() {
      const service = yield* VisitorMetadataService;

      return yield* service.readIp(request);
    }).pipe(Effect.provide(layerLocal));

    await expect(Effect.runPromise(effect)).resolves.toStrictEqual({
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
      sensitivity: "personal",
    });
  });

  it("normalizes trusted live Cloudflare properties with provenance", async () => {
    const metadata = await readMetadata(
      layerLive,
      requestWithMetadata(
        {
          "cf-connecting-ip": "2001:db8::1",
          "cf-ray": "abc123-AKL",
          "x-forwarded-for": "192.0.2.45",
        },
        cfMetadata
      )
    );

    expect(metadata.network.ip).toStrictEqual({
      _tag: "Available",
      source: "cloudflare-request",
      value: { address: "2001:db8::1", version: 6 },
      sensitivity: "personal",
    });
    expect(metadata.network.asn).toMatchObject({
      _tag: "Available",
      source: "cloudflare-request",
      value: 13_335,
    });
    expect(metadata.location.latitude).toMatchObject({
      _tag: "Available",
      value: -41.2865,
      units: "degrees",
    });
    expect(metadata.location.isEuCountry).toMatchObject({
      _tag: "Available",
      value: true,
    });
  });

  it("captures edge, transport and security values with units and sensitivity", async () => {
    const metadata = await readMetadata(
      layerLive,
      requestWithMetadata({ "cf-ray": "abc123-AKL" }, cfMetadata)
    );

    expect(metadata.edge.rayId).toMatchObject({
      _tag: "Available",
      value: "abc123-AKL",
    });
    expect(metadata.connection.tcpRttMs).toMatchObject({
      _tag: "Available",
      value: 18,
      units: "ms",
    });
    expect(metadata.security.ja3).toMatchObject({
      _tag: "Available",
      sensitivity: "sensitive",
    });
    expect(metadata.security.mutualTls).toMatchObject({
      _tag: "Available",
      value: true,
    });
    expect(metadata.connection.quicRttMs).toMatchObject({
      _tag: "Unavailable",
      reason: "not-supported",
    });
  });

  it("decodes an absent TLS client certificate as false", async () => {
    const metadata = await readMetadata(
      layerLive,
      requestWithMetadata(
        {},
        {
          ...cfMetadata,
          tlsClientAuth: { certPresented: "0" },
        }
      )
    );

    expect(metadata.security.mutualTls).toMatchObject({
      _tag: "Available",
      value: false,
    });
  });

  it("keeps local-mode identity and edge values unavailable instead of trusting headers", async () => {
    const metadata = await readMetadata(
      layerLocal,
      requestWithMetadata(
        {
          "cf-connecting-ip": "198.51.100.5",
          "cf-ray": "spoofed-ray",
          "x-forwarded-for": "192.0.2.9",
        },
        cfMetadata
      )
    );

    expect(metadata.network.ip).toStrictEqual({
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
      sensitivity: "personal",
    });
    expect(metadata.edge.rayId).toMatchObject({
      _tag: "Unavailable",
      source: "local-runtime",
    });
    expect(metadata.network.asn).toMatchObject({
      _tag: "Available",
      source: "local-runtime",
      value: 13_335,
    });
  });

  it("marks malformed provider values unavailable without failing the snapshot", async () => {
    const metadata = await readMetadata(
      layerLive,
      requestWithMetadata(
        { "cf-connecting-ip": "not-an-ip" },
        {
          ...cfMetadata,
          latitude: "91",
          asn: 1.5,
        }
      )
    );

    expect(metadata.network.ip).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
    expect(metadata.network.asn).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
    expect(metadata.location.latitude).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
  });

  it("rejects out-of-range ASN, RTT and bot scores", async () => {
    const metadata = await readMetadata(
      layerLive,
      requestWithMetadata(
        {},
        {
          ...cfMetadata,
          asn: 4_294_967_296,
          clientTcpRtt: -1,
          botManagement: { ...cfMetadata.botManagement, score: 100 },
        }
      )
    );

    expect(metadata.network.asn).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
    expect(metadata.connection.tcpRttMs).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
    expect(metadata.security.botScore).toMatchObject({
      _tag: "Unavailable",
      reason: "invalid",
    });
  });

  it("returns deterministic fixture data explicitly labeled as fixture", async () => {
    const metadata = await readMetadata(
      layerFixture,
      requestWithMetadata({ "cf-connecting-ip": "192.0.2.99" })
    );

    expect(metadata.network.ip).toStrictEqual({
      _tag: "Available",
      source: "fixture",
      value: { address: "203.0.113.42", version: 4 },
      sensitivity: "personal",
    });
    expect(metadata.edge.colo).toMatchObject({
      _tag: "Available",
      source: "fixture",
      value: "AKL",
    });
  });

  it("keeps concurrent request snapshots separate", async () => {
    const first = requestWithMetadata(
      { "cf-connecting-ip": "192.0.2.1" },
      cfMetadata
    );

    const second = requestWithMetadata(
      { "cf-connecting-ip": "2001:db8::2" },
      cfMetadata
    );

    const effect = Effect.gen(function* effect() {
      const service = yield* VisitorMetadataService;

      return yield* Effect.all([service.read(first), service.read(second)]);
    }).pipe(Effect.provide(layerLive));

    const [firstResult, secondResult] = await Effect.runPromise(effect);

    expect(firstResult.network.ip).toMatchObject({
      _tag: "Available",
      value: { address: "192.0.2.1", version: 4 },
    });
    expect(secondResult.network.ip).toMatchObject({
      _tag: "Available",
      value: { address: "2001:db8::2", version: 6 },
    });
  });
});
