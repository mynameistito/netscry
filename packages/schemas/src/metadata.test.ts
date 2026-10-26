import { Schema } from "effect";
import { describe, expect, it } from "vitest";

// oxlint-disable sonarjs/no-hardcoded-ip -- These literals are schema fixtures, never network destinations.
import {
  DataSourceSchema,
  NumberDataFieldSchema,
  SensitivitySchema,
  StringDataFieldSchema,
  UnavailableReasonSchema,
} from "./metadata.ts";
import { IpAddressSchema, NetworkIdentitySchema } from "./network.ts";

describe("data provenance schemas", () => {
  it("accepts an available value with its source, sensitivity, and units", () => {
    const decode = Schema.decodeUnknownSync(NumberDataFieldSchema);

    expect(
      decode({
        _tag: "Available",
        source: "cloudflare-request",
        value: 42,
        sensitivity: "personal",
        units: "milliseconds",
      })
    ).toStrictEqual({
      _tag: "Available",
      source: "cloudflare-request",
      value: 42,
      sensitivity: "personal",
      units: "milliseconds",
    });
  });

  it("represents unavailable values with an explicit reason", () => {
    const decode = Schema.decodeUnknownSync(StringDataFieldSchema);

    expect(
      decode({
        _tag: "Unavailable",
        source: "local-runtime",
        reason: "not-provided",
        sensitivity: "personal",
      })
    ).toStrictEqual({
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
      sensitivity: "personal",
    });
  });

  it.each([
    {
      _tag: "Available",
      source: "cloudflare-request",
      value: 42,
      sensitivity: "personal",
    },
    { _tag: "Unavailable", source: "local-runtime", sensitivity: "personal" },
    {
      _tag: "Unavailable",
      source: "browser",
      reason: "not-provided",
      sensitivity: "secret",
    },
  ])("rejects malformed field metadata", (input) => {
    const decode = Schema.decodeUnknownSync(StringDataFieldSchema);

    expect(() => decode(input)).toThrow(Schema.SchemaError);
  });

  it("exposes valid provenance and availability values as schemas", () => {
    expect(Schema.decodeUnknownSync(DataSourceSchema)("derived")).toBe(
      "derived"
    );
    expect(Schema.decodeUnknownSync(SensitivitySchema)("sensitive")).toBe(
      "sensitive"
    );
    expect(Schema.decodeUnknownSync(UnavailableReasonSchema)("redacted")).toBe(
      "redacted"
    );
    expect(Schema.decodeUnknownSync(UnavailableReasonSchema)("invalid")).toBe(
      "invalid"
    );
  });
});

describe("network contracts", () => {
  it("decodes an IP address and derives its TypeScript representation", () => {
    const address = Schema.decodeUnknownSync(IpAddressSchema)({
      address: "2001:db8::1",
      version: 6,
    });

    expect(address).toStrictEqual({ address: "2001:db8::1", version: 6 });
  });

  it.each([
    { address: "999.1.1.1", version: 4 },
    { address: "203.0.113.42", version: 6 },
    { address: "2001:db8::1", version: 4 },
  ])("rejects invalid IP addresses or mismatched versions", (input) => {
    const decode = Schema.decodeUnknownSync(IpAddressSchema);

    expect(() => decode(input)).toThrow(Schema.SchemaError);
  });

  it("requires provenance and availability for each network identity field", () => {
    const decode = Schema.decodeUnknownSync(NetworkIdentitySchema);

    const ip = {
      _tag: "Available",
      source: "cloudflare-request",
      value: { address: "203.0.113.42", version: 4 },
      sensitivity: "personal",
    };

    const unavailableAsn = {
      _tag: "Unavailable",
      source: "local-runtime",
      reason: "not-provided",
      sensitivity: "public",
    };

    expect(
      decode({
        ip,
        asn: unavailableAsn,
        asOrganization: unavailableAsn,
      })
    ).toStrictEqual({
      ip,
      asn: unavailableAsn,
      asOrganization: unavailableAsn,
    });
  });
});
