import { describe, expect, it } from "vitest";

import { normalizeDomain } from "./domain.ts";

describe("domain normalization", () => {
  it.each([
    ["Example.COM", "example.com"],
    ["example.com.", "example.com"],
    ["bücher.example", "xn--bcher-kva.example"],
    ["BÜCHER.Example", "xn--bcher-kva.example"],
    ["例え.テスト", "xn--r8jz45g.xn--zckzah"],
    ["localhost", "localhost"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDomain(input)).toStrictEqual({
      _tag: "Ok",
      value: expected,
    });
  });

  it("accepts the maximum ASCII DNS name length", () => {
    const input = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;

    expect(input).toHaveLength(253);
    expect(normalizeDomain(input)).toStrictEqual({ _tag: "Ok", value: input });
  });

  it.each([
    ["", "InvalidSyntax"],
    ["   ", "InvalidSyntax"],
    ["https://example.com", "InvalidSyntax"],
    ["example.com/path", "InvalidSyntax"],
    ["user@example.com", "InvalidSyntax"],
    ["bad_domain.example", "InvalidDomainName"],
    ["-bad.example", "InvalidDomainName"],
    ["bad-.example", "InvalidDomainName"],
    ["example..com", "InvalidDomainName"],
    [`${"a".repeat(64)}.example`, "InvalidDomainName"],
    ["127.1", "IpAddress"],
    ["192.0.2.1", "IpAddress"],
    ["[2001:db8::1]", "InvalidSyntax"],
    ["xn--.example", "InvalidDomainName"],
  ])("rejects %s with a typed reason", (input, reason) => {
    expect(normalizeDomain(input)).toStrictEqual({
      _tag: "Err",
      error: { _tag: "InvalidDomain", reason },
    });
  });

  it("rejects names longer than the DNS text limit", () => {
    const input = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;

    expect(input).toHaveLength(254);
    expect(normalizeDomain(input)).toStrictEqual({
      _tag: "Err",
      error: { _tag: "InvalidDomain", reason: "InvalidDomainName" },
    });
  });
});
