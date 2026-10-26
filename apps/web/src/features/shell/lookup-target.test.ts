import { describe, expect, it } from "vitest";

import {
  getPublicLookupHref,
  resolvePublicLookupTarget,
} from "./lookup-target";

describe(resolvePublicLookupTarget, () => {
  it.each([
    ["192.0.2.1", { kind: "ip", query: "192.0.2.1" }, "/ip/192.0.2.1"],
    [
      // oxlint-disable-next-line sonarjs/no-hardcoded-ip -- RFC 3849 documentation prefix for IPv6 parser coverage.
      "2001:DB8::1",
      { kind: "ip", query: "2001:db8::1" },
      "/ip/2001%3Adb8%3A%3A1",
    ],
    [
      "192.0.2.4/24",
      { kind: "cidr", query: "192.0.2.0/24" },
      "/ip/192.0.2.0%2F24",
    ],
    ["as064500", { kind: "asn", query: "AS64500" }, "/asn/AS64500"],
    [
      "bücher.example",
      { kind: "domain", query: "xn--bcher-kva.example" },
      "/domain/xn--bcher-kva.example",
    ],
  ])("normalizes %s for a route", (query, target, href) => {
    const result = resolvePublicLookupTarget(query);

    expect(result._tag).toBe("Ok");

    if (result._tag === "Err") {
      throw new Error(result.message);
    }

    expect(result).toStrictEqual({
      _tag: "Ok",
      value: target,
    });
    expect(getPublicLookupHref(result.value)).toBe(href);
  });

  it("returns one safe validation message for unsupported text", () => {
    expect(resolvePublicLookupTarget("https://example.com/path")).toStrictEqual(
      {
        _tag: "Err",
        message: "Enter a valid IP address, network, ASN, or domain.",
      }
    );
  });
});
