import { describe, expect, it } from "vitest";

import { parsePublicLookupQuery } from "./lookup-query.ts";

// oxlint-disable sonarjs/no-hardcoded-ip -- Documentation-range IP values are parse-only inputs; these tests make no network requests.
describe("public lookup query classification", () => {
  it.each([
    ["198.51.100.7", { kind: "ip", query: "198.51.100.7" }],
    ["2001:0db8::1", { kind: "ip", query: "2001:db8::1" }],
    ["192.0.2.129/24", { kind: "cidr", query: "192.0.2.0/24" }],
    ["2001:db8:1::5/48", { kind: "cidr", query: "2001:db8:1::/48" }],
    [" AS001335 ", { kind: "asn", query: "AS1335", value: 1335 }],
    ["13335", { kind: "asn", query: "AS13335", value: 13_335 }],
    ["Example.COM.", { kind: "domain", query: "example.com" }],
    ["bücher.example", { kind: "domain", query: "xn--bcher-kva.example" }],
  ])("normalizes %s", (input, expected) => {
    expect(parsePublicLookupQuery(input)).toStrictEqual({
      _tag: "Ok",
      value: expected,
    });
  });

  it.each([
    ["", "Empty"],
    ["  ", "Empty"],
    ["192.0.2.1/33", "Invalid"],
    ["not-an-ip/24", "Invalid"],
    ["AS4294967295", "Invalid"],
    ["4294967295", "Invalid"],
    ["192.0.2.999", "Invalid"],
    ["https://example.com", "Invalid"],
    ["example.com:443", "Invalid"],
  ])("rejects %j with a structured reason", (input, reason) => {
    expect(parsePublicLookupQuery(input)).toStrictEqual({
      _tag: "Err",
      error: { _tag: "InvalidPublicLookupQuery", reason },
    });
  });
});
