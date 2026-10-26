import type { ApiMeResponse } from "@netscry/schemas";

import type { NetworkLocation } from "./network-map";

type CloudflareCoordinate = Extract<
  ApiMeResponse["location"]["latitude"],
  { readonly _tag: "Available" }
> & { readonly source: "cloudflare-request" };

const isCloudflareCoordinate = (
  field: ApiMeResponse["location"]["latitude"]
): field is CloudflareCoordinate =>
  field._tag === "Available" && field.source === "cloudflare-request";

const sourceLabel = (
  field: ApiMeResponse["location"]["city"]
): string | null =>
  field._tag === "Available" && field.source === "cloudflare-request"
    ? field.value
    : null;

/** Return a map point only when both coordinates came from Cloudflare request metadata.
 * @param data - The normalized visitor metadata response.
 * @returns A verified approximate IP location or null when coordinates are unavailable.
 */
export const getVisitorMapLocation = (
  data: Pick<
    ApiMeResponse["location"],
    "latitude" | "longitude" | "city" | "region" | "country"
  >
): NetworkLocation | null => {
  const { latitude, longitude } = data;

  if (!isCloudflareCoordinate(latitude) || !isCloudflareCoordinate(longitude)) {
    return null;
  }

  const city = sourceLabel(data.city);
  const region = sourceLabel(data.region);
  const country = sourceLabel(data.country);
  const label = [city, region, country].filter(Boolean).join(", ");

  return {
    latitude: latitude.value,
    longitude: longitude.value,
    label: label.length === 0 ? "Approximate visitor IP location" : label,
  };
};
