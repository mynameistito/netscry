import type { ApiMeResponse } from "@netscry/schemas";

import { coloAirportReferences } from "./colo-airport-references";
import type { NetworkLocation } from "./network-map";

type CloudflareColo = Extract<
  ApiMeResponse["edge"]["colo"],
  { readonly _tag: "Available" }
> & { readonly source: "cloudflare-request" };

const isCloudflareColo = (
  field: ApiMeResponse["edge"]["colo"]
): field is CloudflareColo =>
  field._tag === "Available" && field.source === "cloudflare-request";

/** Return a mapped airport reference only for a known Cloudflare colo code.
 * @param field - The normalized Cloudflare colo metadata.
 * @returns Airport-reference coordinates or null when provenance or data is unavailable.
 */
export const getColoAirportReference = (
  field: ApiMeResponse["edge"]["colo"]
): NetworkLocation | null => {
  if (!isCloudflareColo(field) || !/^[A-Z]{3}$/u.test(field.value)) {
    return null;
  }

  const airport = Object.entries(coloAirportReferences).find(
    ([code]) => code === field.value
  )?.[1];

  if (airport === undefined) {
    return null;
  }

  return {
    latitude: airport.latitude,
    longitude: airport.longitude,
    label: `${field.value} · ${airport.airportName} (airport reference)`,
  };
};
