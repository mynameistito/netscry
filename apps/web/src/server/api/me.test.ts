import {
  ApiMeAsnResponseSchema,
  ApiMeColoResponseSchema,
  ApiMeCountryResponseSchema,
  ApiMeHeadersResponseSchema,
  ApiMeIpResponseSchema,
  ApiMeResponseSchema,
  ApiMeTraceResponseSchema,
  ConnectionMetadataSchema,
  EdgeMetadataSchema,
  GeographicLocationSchema,
  NetworkIdentitySchema,
  RawCloudflareMetadataSchema,
  SecurityMetadataSchema,
} from "@netscry/schemas";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { handleMeApiOverview, handleMeApiRequest } from "./me.ts";

const cloudflareMetadata = {
  asn: 13_335,
  asOrganization: "Cloudflare, Inc.",
  city: "Auckland",
  colo: "AKL",
  continent: "OC",
  country: "NZ",
  httpProtocol: "HTTP/2",
  isEUCountry: "1",
  latitude: "-36.8509",
  longitude: "174.7645",
  region: "Auckland Region",
  regionCode: "AUK",
  timezone: "Pacific/Auckland",
  tlsCipher: "TLS_AES_128_GCM_SHA256",
  tlsVersion: "TLSv1.3",
} satisfies Partial<IncomingRequestCfProperties>;

const makeRequest = (accept = "application/json") => {
  const request = new Request("https://netscry.example/api/v1/me", {
    headers: {
      accept,
      "accept-language": "en-NZ,en;q=0.9",
      "cf-connecting-ip": "2001:db8::1",
      "cf-ray": "test-ray-AKL",
      cookie: "session=private-canary",
      authorization: "Bearer private-canary",
      "user-agent": "NetscryTest/1.0",
    },
  });

  return Object.assign(request, { cf: cloudflareMetadata });
};

describe("visitor API endpoints", () => {
  it("returns the complete schema-validated snapshot from the request metadata", async () => {
    const response = await handleMeApiOverview(makeRequest(), "live");

    expect(response.status).toBe(200);
    expect(
      Schema.decodeUnknownSync(ApiMeResponseSchema)(await response.json())
        .network.ip
    ).toStrictEqual({
      _tag: "Available",
      source: "cloudflare-request",
      value: { address: "2001:db8::1", version: 6 },
      sensitivity: "personal",
    });
  });

  it.each([
    ["ip", ApiMeIpResponseSchema],
    ["asn", ApiMeAsnResponseSchema],
    ["country", ApiMeCountryResponseSchema],
    ["colo", ApiMeColoResponseSchema],
    ["location", GeographicLocationSchema],
    ["network", NetworkIdentitySchema],
    ["edge", EdgeMetadataSchema],
    ["connection", ConnectionMetadataSchema],
    ["security", SecurityMetadataSchema],
    ["headers", ApiMeHeadersResponseSchema],
    ["trace", ApiMeTraceResponseSchema],
    ["raw", RawCloudflareMetadataSchema],
  ] as const)(
    "returns the `%s` contract with no-store",
    async (endpoint, schema) => {
      const response = await handleMeApiRequest(
        makeRequest(),
        endpoint,
        "live"
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(
        Schema.decodeUnknownSync(schema)(await response.json())
      ).toBeDefined();
    }
  );

  it("returns plain IP and ASN values without JSON decoration", async () => {
    const ip = await handleMeApiRequest(
      makeRequest("text/plain"),
      "ip",
      "live"
    );

    const asnRequest = makeRequest("text/plain");

    const asn = await handleMeApiRequest(asnRequest, "asn", "live");

    expect(ip.status).toBe(200);
    expect(ip.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    await expect(ip.text()).resolves.toBe("2001:db8::1\n");
    expect(asn.status).toBe(200);
    await expect(asn.text()).resolves.toBe("13335\n");
  });

  it("returns an explicit unavailable response for local scalar text requests", async () => {
    const response = await handleMeApiRequest(
      new Request("https://netscry.example/api/v1/me/ip", {
        headers: { accept: "text/plain", "cf-connecting-ip": "198.51.100.7" },
      }),
      "ip",
      "local"
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
  });

  it("does not include cookies or authorization in the selected header view", async () => {
    const response = await handleMeApiRequest(makeRequest(), "headers", "live");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain("private-canary");
    expect(
      Schema.decodeUnknownSync(ApiMeHeadersResponseSchema)(JSON.parse(body))
        .userAgent
    ).toMatchObject({ value: "NetscryTest/1.0", source: "request-header" });
  });

  it("returns typed errors for unsupported endpoints and representations", async () => {
    const missing = await handleMeApiRequest(makeRequest(), "missing", "live");

    const unacceptable = await handleMeApiRequest(
      makeRequest("text/html"),
      "location",
      "live"
    );

    expect([missing.status, unacceptable.status]).toStrictEqual([404, 406]);
  });
});
