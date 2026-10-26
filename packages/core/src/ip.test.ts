import { describe, expect, it } from "vitest";

// oxlint-disable sonarjs/no-hardcoded-ip -- These literals are parser fixtures, never network destinations.
import { parseIpAddress, parseIpv4, parseIpv6 } from "./ip.ts";
import type { Result } from "./result.ts";

const expectSuccess = <Value, Failure>(
  result: Result<Value, Failure>
): Value => {
  if (result._tag === "Err") {
    throw new Error("Expected successful parsing");
  }

  return result.value;
};

describe("IPv4 address parsing", () => {
  it("returns canonical dotted decimal and packed bytes", () => {
    expect(parseIpv4("203.0.113.42")).toStrictEqual({
      _tag: "Ok",
      value: {
        version: 4,
        canonical: "203.0.113.42",
        bytes: [203, 0, 113, 42],
      },
    });
  });

  it.each([
    "",
    "256.1.1.1",
    "1.2.3",
    "1.2.3.4.5",
    "01.2.3.4",
    "+1.2.3.4",
    " 1.2.3.4",
  ])("rejects non-canonical or out-of-range input %s", (input) => {
    expect(parseIpv4(input)._tag).toBe("Err");
  });
});

describe("IPv6 address parsing", () => {
  it.each([
    ["2001:0DB8:0000:0000:0000:FF00:0042:8329", "2001:db8::ff00:42:8329"],
    ["2001:db8:0:1:0:0:0:1", "2001:db8:0:1::1"],
    ["::", "::"],
    ["::ffff:192.0.2.1", "::ffff:c000:201"],
    ["2001:db8::192.0.2.1", "2001:db8::c000:201"],
  ])("canonicalizes %s", (input, canonical) => {
    const address = expectSuccess(parseIpv6(input));
    expect(address.canonical).toBe(canonical);
    expect(address.bytes).toHaveLength(16);
  });

  it.each([
    "",
    "1:2:3:4:5:6:7",
    "1:2:3:4:5:6:7:8:9",
    "1::2::3",
    "1:2:3:4:5:6:7:8::",
    "1::g",
    "fe80::1%eth0",
    "::ffff:192.0.2.999",
  ])("rejects malformed input %s", (input) => {
    expect(parseIpv6(input)._tag).toBe("Err");
  });
});

describe("IP address family parsing", () => {
  it("selects the address family from the input syntax", () => {
    expect(parseIpAddress("192.0.2.1")._tag).toBe("Ok");
    expect(parseIpAddress("2001:db8::1")._tag).toBe("Ok");
  });
});
