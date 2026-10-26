import {
  ApiErrorResponseSchema,
  PublicCidrLookupResponseSchema,
  PublicIpLookupResponseSchema,
} from "@netscry/schemas";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

// oxlint-disable sonarjs/no-hardcoded-ip -- These values are parse-only fixtures; the lookup handler makes no network requests.
import { handlePublicIpLookup } from "./ip.ts";

const requestFor = (input: string, accept = "application/json") =>
  new Request(
    `https://netscry.example/api/v1/ip/${encodeURIComponent(input)}`,
    {
      headers: { accept },
    }
  );

describe("public IP and CIDR lookup API", () => {
  it("canonicalizes IPv4 and labels selected special-purpose classifications", async () => {
    const response = await handlePublicIpLookup(
      requestFor("192.0.2.42"),
      "192.0.2.42"
    );

    const decoded = Schema.decodeUnknownSync(PublicIpLookupResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    expect(decoded).toStrictEqual({
      kind: "address",
      input: "192.0.2.42",
      address: { address: "192.0.2.42", version: 4 },
      classification: {
        _tag: "Available",
        source: "derived",
        value: "documentation",
        sensitivity: "public",
      },
      classificationNote: {
        _tag: "Available",
        source: "derived",
        value: "This address is in a documentation range.",
        sensitivity: "public",
      },
      provenance: {
        source: "derived",
        method: "selected-ip-purpose-ranges",
      },
    });
  });

  it("canonicalizes IPv6 without treating an unclassified address as public", async () => {
    const response = await handlePublicIpLookup(
      requestFor("2001:4860:4860::8888"),
      "2001:4860:4860::8888"
    );

    const decoded = Schema.decodeUnknownSync(PublicIpLookupResponseSchema)(
      await response.json()
    );

    expect(decoded.address).toStrictEqual({
      address: "2001:4860:4860::8888",
      version: 6,
    });
    expect(decoded.classification).toStrictEqual({
      _tag: "Available",
      source: "derived",
      value: "unclassified",
      sensitivity: "public",
    });
  });

  it("normalizes an IPv4 CIDR and returns bounds and exact address count", async () => {
    const response = await handlePublicIpLookup(
      requestFor("192.0.2.129/24"),
      "192.0.2.129/24"
    );

    const decoded = Schema.decodeUnknownSync(PublicCidrLookupResponseSchema)(
      await response.json()
    );

    expect(decoded.network).toBe("192.0.2.0/24");
    expect(decoded).toMatchObject({
      networkAddress: { address: "192.0.2.0", version: 4 },
      lastAddress: { address: "192.0.2.255", version: 4 },
      addressCount: "256",
    });
  });

  it("supports large IPv6 CIDRs with exact decimal counts", async () => {
    const response = await handlePublicIpLookup(
      requestFor("2001:db8::1/126"),
      "2001:db8::1/126"
    );

    const decoded = Schema.decodeUnknownSync(PublicCidrLookupResponseSchema)(
      await response.json()
    );

    expect(decoded.network).toBe("2001:db8::/126");
    expect(decoded.addressCount).toBe("4");
    expect(decoded.version).toBe(6);
  });

  it.each(["", "not-an-ip", "192.0.2.1/33", "2001:db8::/129"])(
    "returns a typed invalid-input error for %s",
    async (input) => {
      const response = await handlePublicIpLookup(requestFor(input), input);

      const error = Schema.decodeUnknownSync(ApiErrorResponseSchema)(
        await response.json()
      );

      expect(response.status).toBe(400);
      expect(error.error.code).toBe("invalid-input");
    }
  );

  it("rejects an oversized path segment before parsing", async () => {
    const input = "x".repeat(129);
    const response = await handlePublicIpLookup(requestFor(input), input);

    expect(response.status).toBe(400);
  });

  it("rejects unsupported representations", async () => {
    const response = await handlePublicIpLookup(
      requestFor("203.0.113.9", "text/plain"),
      "203.0.113.9"
    );

    expect(response.status).toBe(406);
  });
});
