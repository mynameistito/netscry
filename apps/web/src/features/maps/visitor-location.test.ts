import type { ApiMeResponse } from "@netscry/schemas";
import { describe, expect, it } from "vitest";

import { getVisitorMapLocation } from "./visitor-location";

type VisitorLocation = Pick<
  ApiMeResponse["location"],
  "latitude" | "longitude" | "city" | "region" | "country"
>;

const available = <Value>(
  value: Value,
  source: "cloudflare-request" | "fixture" = "cloudflare-request"
) => ({
  _tag: "Available" as const,
  source,
  value,
  sensitivity: "personal" as const,
});

const unavailable = {
  _tag: "Unavailable" as const,
  source: "local-runtime" as const,
  reason: "not-supported" as const,
  sensitivity: "personal" as const,
};

const visitorLocation = (
  overrides: Partial<VisitorLocation> = {}
): VisitorLocation => ({
  latitude: available(-36.85, "cloudflare-request"),
  longitude: available(174.76, "cloudflare-request"),
  city: available("Auckland", "cloudflare-request"),
  region: available("Auckland Region", "cloudflare-request"),
  country: available("NZ", "cloudflare-request"),
  ...overrides,
});

describe(getVisitorMapLocation, () => {
  it("maps Cloudflare IP coordinates and uses only matching source labels", () => {
    expect(getVisitorMapLocation(visitorLocation())).toStrictEqual({
      latitude: -36.85,
      longitude: 174.76,
      label: "Auckland, Auckland Region, NZ",
    });
  });

  it("does not map fixture coordinates as a real visitor location", () => {
    expect(
      getVisitorMapLocation(
        visitorLocation({
          latitude: available(-36.85, "fixture"),
          longitude: available(174.76, "fixture"),
        })
      )
    ).toBeNull();
  });

  it("keeps the map empty when either Cloudflare coordinate is unavailable", () => {
    expect(
      getVisitorMapLocation(visitorLocation({ longitude: unavailable }))
    ).toBeNull();
  });

  it("uses a clear fallback label when Cloudflare supplies coordinates without place names", () => {
    expect(
      getVisitorMapLocation(
        visitorLocation({
          city: unavailable,
          region: unavailable,
          country: unavailable,
        })
      )
    ).toStrictEqual({
      latitude: -36.85,
      longitude: 174.76,
      label: "Approximate visitor IP location",
    });
  });
});
