import { describe, expect, it } from "vitest";

// oxlint-disable sonarjs/no-hardcoded-ip -- These literals are parser fixtures, never network destinations.
import { parseDnsRecordData, parseDnsTtl } from "./dns.ts";

describe("DNS address records", () => {
  it("parses A and AAAA values into normalized IP data", () => {
    expect(parseDnsRecordData("a", "192.0.2.4")).toMatchObject({
      _tag: "Ok",
      value: {
        type: "A",
        address: { version: 4, canonical: "192.0.2.4" },
      },
    });
    expect(parseDnsRecordData("AAAA", "2001:0db8::1")).toMatchObject({
      _tag: "Ok",
      value: {
        type: "AAAA",
        address: { version: 6, canonical: "2001:db8::1" },
      },
    });
  });

  it.each([
    ["A", "2001:db8::1"],
    ["AAAA", "192.0.2.1"],
    ["A", "256.0.2.1"],
  ])("rejects invalid %s address data %s", (type, data) => {
    expect(parseDnsRecordData(type, data)).toMatchObject({
      _tag: "Err",
      error: { _tag: "InvalidDnsRecord", reason: "InvalidRecordData" },
    });
  });
});

describe("DNS name-target records", () => {
  it.each(["CNAME", "NS", "PTR"])("normalizes a %s target", (type) => {
    expect(parseDnsRecordData(type, "BÜCHER.example.")).toStrictEqual({
      _tag: "Ok",
      value: { type, target: "xn--bcher-kva.example" },
    });
  });

  it("preserves the root target marker", () => {
    expect(parseDnsRecordData("NS", ".")).toStrictEqual({
      _tag: "Ok",
      value: { type: "NS", target: "." },
    });
  });
});

describe("structured DNS records", () => {
  it("parses MX preference and exchange", () => {
    expect(parseDnsRecordData("MX", "10 Mail.Example.com.")).toStrictEqual({
      _tag: "Ok",
      value: { type: "MX", preference: 10, exchange: "mail.example.com" },
    });
  });

  it("parses SRV priority, weight, port, and target", () => {
    expect(
      parseDnsRecordData("SRV", "5 10 5060 sip.example.com.")
    ).toStrictEqual({
      _tag: "Ok",
      value: {
        type: "SRV",
        priority: 5,
        weight: 10,
        port: 5060,
        target: "sip.example.com",
      },
    });
  });

  it("parses SOA fields and validates its unsigned counters", () => {
    expect(
      parseDnsRecordData(
        "SOA",
        "ns.example.com. hostmaster.example.com. 2024010101 3600 600 604800 300"
      )
    ).toStrictEqual({
      _tag: "Ok",
      value: {
        type: "SOA",
        mname: "ns.example.com",
        rname: "hostmaster.example.com",
        serial: 2_024_010_101,
        refresh: 3600,
        retry: 600,
        expire: 604_800,
        minimum: 300,
      },
    });
  });

  it("parses CAA flags, lowercases the tag, and unquotes its value", () => {
    expect(
      parseDnsRecordData("CAA", '0 ISSUE "letsencrypt.org"')
    ).toStrictEqual({
      _tag: "Ok",
      value: {
        type: "CAA",
        flags: 0,
        tag: "issue",
        value: "letsencrypt.org",
      },
    });
  });

  it("preserves TXT presentation data", () => {
    expect(parseDnsRecordData("TXT", '"v=spf1 -all"')).toStrictEqual({
      _tag: "Ok",
      value: { type: "TXT", text: '"v=spf1 -all"' },
    });
  });

  it.each([
    ["MX", "65536 mail.example.com"],
    ["SRV", "0 0 70000 sip.example.com"],
    ["SOA", "ns.example.com hostmaster.example.com 1 2 3 4"],
    ["CAA", "256 issue letsencrypt.org"],
  ])("rejects malformed %s data", (type, data) => {
    expect(parseDnsRecordData(type, data)).toMatchObject({
      _tag: "Err",
      error: { _tag: "InvalidDnsRecord", reason: "InvalidRecordData" },
    });
  });

  it("rejects unsupported record types", () => {
    expect(parseDnsRecordData("DNSKEY", "key data")).toStrictEqual({
      _tag: "Err",
      error: { _tag: "InvalidDnsRecord", reason: "InvalidRecordType" },
    });
  });
});

describe("DNS TTL parsing", () => {
  it.each([0, 60, 4_294_967_295])("accepts TTL %i seconds", (ttl) => {
    expect(parseDnsTtl(ttl)).toStrictEqual({ _tag: "Ok", value: ttl });
  });

  it.each([-1, 4_294_967_296, 1.5, Number.NaN])(
    "rejects invalid TTL %s",
    (ttl) => {
      expect(parseDnsTtl(ttl)).toStrictEqual({
        _tag: "Err",
        error: { _tag: "InvalidDnsRecord", reason: "InvalidTtl" },
      });
    }
  );
});
