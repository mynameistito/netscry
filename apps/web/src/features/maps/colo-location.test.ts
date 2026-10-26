import type { ApiMeResponse } from "@netscry/schemas";
import { describe, expect, it } from "vitest";

import { getColoAirportReference } from "./colo-location";

type ColoField = ApiMeResponse["edge"]["colo"];

const available = (
  value: string,
  source: "cloudflare-request" | "fixture" = "cloudflare-request"
): ColoField => ({
  _tag: "Available",
  source,
  value,
  sensitivity: "public",
});

const unavailable: ColoField = {
  _tag: "Unavailable",
  source: "local-runtime",
  reason: "not-supported",
  sensitivity: "public",
};

describe(getColoAirportReference, () => {
  it("maps a known Cloudflare colo to its airport reference coordinates", () => {
    expect(getColoAirportReference(available("AKL"))).toStrictEqual({
      latitude: -37.01199,
      longitude: 174.786331,
      label: "AKL · Auckland International Airport (airport reference)",
    });
  });

  it("does not map fixture or local-runtime colo values", () => {
    expect(getColoAirportReference(available("AKL", "fixture"))).toBeNull();
    expect(getColoAirportReference(unavailable)).toBeNull();
  });

  it("keeps unknown or malformed colo codes unavailable", () => {
    expect(getColoAirportReference(available("AIP"))).toBeNull();
    expect(getColoAirportReference(available("akl"))).toBeNull();
    expect(getColoAirportReference(available("AKL1"))).toBeNull();
  });
});
