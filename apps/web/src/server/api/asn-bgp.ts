import { parseAsn, parseCidr, parseIpAddress } from "@netscry/core";
import {
  PublicAsnLookupResponseSchema,
  PublicBgpPrefixLookupResponseSchema,
} from "@netscry/schemas";
import { Effect } from "effect";
import type { Layer } from "effect";

import { AsnBgpService, layerLive } from "../services/asn-bgp.ts";
import { apiErrorResponse, respondWithApiEffect } from "./http.ts";

const MAX_ASN_LOOKUP_LENGTH = 16;
const MAX_PREFIX_LOOKUP_LENGTH = 128;
const INVALID_INPUT_CODE = "invalid-input" as const;

const runAsnLookup = (
  input: string,
  serviceLayer: Layer.Layer<AsnBgpService>
) =>
  Effect.gen(function* lookup() {
    const service = yield* AsnBgpService;

    return yield* service.lookupAsn(input);
  }).pipe(Effect.provide(serviceLayer));

const runPrefixLookup = (
  input: string,
  serviceLayer: Layer.Layer<AsnBgpService>
) =>
  Effect.gen(function* lookup() {
    const service = yield* AsnBgpService;

    return yield* service.lookupPrefix(input);
  }).pipe(Effect.provide(serviceLayer));

/** Resolve public ASN registration and observed RouteViews prefixes.
 * @param request - Incoming API request for representation negotiation.
 * @param input - Untrusted numeric or AS-prefixed autonomous system number.
 * @param serviceLayer - Optional service Layer used by isolated tests.
 * @returns A schema-validated ASN response or a stable API error response.
 */
export const handleAsnLookup = async (
  request: Request,
  input: string,
  serviceLayer: Layer.Layer<AsnBgpService> = layerLive
): Promise<Response> => {
  const candidate = input.trim();

  if (
    candidate.length === 0 ||
    candidate.length > MAX_ASN_LOOKUP_LENGTH ||
    parseAsn(candidate)._tag === "Err"
  ) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "Enter a valid 32-bit autonomous system number.",
      400
    );
  }

  return await respondWithApiEffect(
    request,
    PublicAsnLookupResponseSchema,
    runAsnLookup(candidate, serviceLayer),
    {
      cacheControl:
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    }
  );
};

const isValidPrefixInput = (input: string) => {
  if (input.includes("/")) {
    return parseCidr(input)._tag === "Ok";
  }

  return parseIpAddress(input)._tag === "Ok";
};

/** Resolve observed BGP origins and peer paths for an IP or CIDR query.
 * @param request - Incoming API request for representation negotiation/query.
 * @param input - Untrusted IPv4/IPv6 address or CIDR prefix.
 * @param serviceLayer - Optional service Layer used by isolated tests.
 * @returns A schema-validated RouteViews response or a stable API error response.
 */
export const handleBgpPrefixLookup = async (
  request: Request,
  input: string,
  serviceLayer: Layer.Layer<AsnBgpService> = layerLive
): Promise<Response> => {
  const candidate = input.trim();

  if (
    candidate.length === 0 ||
    candidate.length > MAX_PREFIX_LOOKUP_LENGTH ||
    !isValidPrefixInput(candidate)
  ) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "Enter a valid IPv4 or IPv6 address, optionally followed by a CIDR prefix.",
      400
    );
  }

  const parameters = new URL(request.url).searchParams.getAll("prefix");

  if (
    parameters.length > 1 ||
    (parameters.length === 1 && parameters[0] !== input)
  ) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "Provide exactly one prefix query parameter matching the lookup input.",
      400
    );
  }

  return await respondWithApiEffect(
    request,
    PublicBgpPrefixLookupResponseSchema,
    runPrefixLookup(candidate, serviceLayer),
    {
      cacheControl:
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    }
  );
};

/** Resolve the prefix supplied in the `prefix` query parameter.
 * @param request - Incoming API request.
 * @param serviceLayer - Optional service Layer used by isolated tests.
 * @returns A schema-validated BGP response or a stable API error response.
 */
export const handleBgpPrefixQuery = async (
  request: Request,
  serviceLayer: Layer.Layer<AsnBgpService> = layerLive
): Promise<Response> => {
  const parameters = new URL(request.url).searchParams.getAll("prefix");
  const [input] = parameters;

  if (input === undefined || parameters.length !== 1) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "Provide exactly one prefix query parameter.",
      400
    );
  }

  return await handleBgpPrefixLookup(request, input, serviceLayer);
};
