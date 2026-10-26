import { describe, expect, it } from "vitest";

// oxlint-disable sonarjs/no-hardcoded-ip -- These literals are parser fixtures, never network destinations.
import { classifyIpAddress } from "./ip-classification.ts";
import { parseIpAddress } from "./ip.ts";

const classify = (input: string) => {
  const parsed = parseIpAddress(input);

  if (parsed._tag === "Err") {
    throw new Error("Expected a valid IP address fixture");
  }

  return classifyIpAddress(parsed.value);
};

describe("IPv4 address classification", () => {
  it.each([
    ["0.0.0.0", "unspecified"],
    ["10.42.0.1", "private-use"],
    ["100.64.0.1", "shared"],
    ["127.0.0.1", "loopback"],
    ["169.254.10.20", "link-local"],
    ["192.0.2.10", "documentation"],
    ["198.18.1.1", "benchmarking"],
    ["224.0.0.1", "multicast"],
    ["240.0.0.1", "reserved"],
    ["255.255.255.255", "limited-broadcast"],
  ])("classifies %s as %s", (address, expected) => {
    expect(classify(address)).toBe(expected);
  });

  it("leaves unlisted address space unclassified", () => {
    expect(classify("8.8.8.8")).toBe("unclassified");
  });
});

describe("IPv6 address classification", () => {
  it.each([
    ["::", "unspecified"],
    ["::1", "loopback"],
    ["::ffff:192.0.2.1", "ipv4-mapped"],
    ["100::1", "discard-only"],
    ["2001:2::1", "benchmarking"],
    ["2001:db8::1", "documentation"],
    ["2002::1", "transition"],
    ["fd12:3456:789a::1", "unique-local"],
    ["fe80::1", "link-local"],
    ["ff02::1", "multicast"],
  ])("classifies %s as %s", (address, expected) => {
    expect(classify(address)).toBe(expected);
  });

  it("does not treat unlisted global-unicast space as a routability claim", () => {
    expect(classify("2001:4860:4860::8888")).toBe("unclassified");
  });
});
