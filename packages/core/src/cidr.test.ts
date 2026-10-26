import { describe, expect, it } from "vitest";

// oxlint-disable sonarjs/no-hardcoded-ip -- These literals are parser fixtures, never network destinations.
import { containsIpAddress, parseCidr } from "./cidr.ts";
import { parseIpAddress } from "./ip.ts";
import type { IpAddress } from "./ip.ts";
import type { Result } from "./result.ts";

const expectSuccess = <Value, Failure>(
  result: Result<Value, Failure>
): Value => {
  if (result._tag === "Err") {
    throw new Error("Expected successful parsing");
  }

  return result.value;
};

const parseAddress = (input: string): IpAddress => {
  const result = parseIpAddress(input);

  if (result._tag === "Err") {
    throw new Error("Expected a valid IP address fixture");
  }

  return result.value;
};

describe("IPv4 CIDR parsing", () => {
  it("calculates canonical network and final addresses", () => {
    expect(expectSuccess(parseCidr("192.0.2.129/24"))).toStrictEqual({
      version: 4,
      prefixLength: 24,
      canonical: "192.0.2.0/24",
      networkAddress: {
        version: 4,
        canonical: "192.0.2.0",
        bytes: [192, 0, 2, 0],
      },
      lastAddress: {
        version: 4,
        canonical: "192.0.2.255",
        bytes: [192, 0, 2, 255],
      },
      addressCount: 256n,
    });
  });

  it.each([
    ["0.0.0.0/0", "0.0.0.0", "255.255.255.255", 4_294_967_296n],
    ["255.255.255.255/32", "255.255.255.255", "255.255.255.255", 1n],
  ])("handles the boundary CIDR %s", (input, network, last, count) => {
    const cidr = expectSuccess(parseCidr(input));

    expect(cidr.networkAddress.canonical).toBe(network);
    expect(cidr.lastAddress.canonical).toBe(last);
    expect(cidr.addressCount).toBe(count);
  });
});

describe("IPv6 CIDR parsing", () => {
  it("calculates a large range without number precision loss", () => {
    const cidr = expectSuccess(parseCidr("2001:db8:abcd::1/48"));

    expect(cidr.canonical).toBe("2001:db8:abcd::/48");
    expect(cidr.networkAddress.canonical).toBe("2001:db8:abcd::");
    expect(cidr.lastAddress.canonical).toBe(
      "2001:db8:abcd:ffff:ffff:ffff:ffff:ffff"
    );
    expect(cidr.addressCount).toBe(2n ** 80n);
  });

  it.each([
    ["::/0", "::", "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", 2n ** 128n],
    [
      "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128",
      "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
      "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
      1n,
    ],
  ])("handles the boundary CIDR %s", (input, network, last, count) => {
    const cidr = expectSuccess(parseCidr(input));

    expect(cidr.networkAddress.canonical).toBe(network);
    expect(cidr.lastAddress.canonical).toBe(last);
    expect(cidr.addressCount).toBe(count);
  });
});

describe("CIDR containment", () => {
  it("includes both bounds and excludes an adjacent address", () => {
    const cidr = expectSuccess(parseCidr("192.0.2.128/25"));

    expect(containsIpAddress(cidr, parseAddress("192.0.2.128"))).toBeTruthy();
    expect(containsIpAddress(cidr, parseAddress("192.0.2.255"))).toBeTruthy();
    expect(containsIpAddress(cidr, parseAddress("192.0.2.127"))).toBeFalsy();
  });

  it("does not match addresses from another family", () => {
    const cidr = expectSuccess(parseCidr("192.0.2.0/24"));

    expect(containsIpAddress(cidr, parseAddress("2001:db8::1"))).toBeFalsy();
  });
});

describe("CIDR parsing failures", () => {
  it.each([
    ["192.0.2.1", "InvalidCidrSyntax"],
    ["192.0.2.1/24/5", "InvalidCidrSyntax"],
    ["192.0.2.1/", "InvalidCidrSyntax"],
    ["not-an-ip/24", "InvalidIpAddress"],
    ["192.0.2.1/33", "InvalidPrefixLength"],
    ["2001:db8::1/129", "InvalidPrefixLength"],
  ])("rejects %s with a typed reason", (input, reason) => {
    expect(parseCidr(input)).toStrictEqual({
      _tag: "Err",
      error: { _tag: "InvalidIpCidr", reason },
    });
  });
});
