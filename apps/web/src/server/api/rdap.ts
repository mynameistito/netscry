import { RdapNormalizedRecordSchema } from "@netscry/schemas";
import type { Layer } from "effect";
import { Effect } from "effect";

import type { RdapLookupTarget } from "../services/rdap-bootstrap.ts";
import { parseRdapLookupTarget } from "../services/rdap-bootstrap.ts";
import { RdapService, layerLive } from "../services/rdap.ts";
import { apiErrorResponse, respondWithApiEffect } from "./http.ts";

const MAX_IP_LOOKUP_LENGTH = 128;
const MAX_DOMAIN_LOOKUP_LENGTH = 254;

const runLookup = (
  target: RdapLookupTarget,
  serviceLayer: Layer.Layer<RdapService>
) =>
  Effect.gen(function* lookup() {
    const service = yield* RdapService;

    return yield* service.lookup(target);
  }).pipe(Effect.provide(serviceLayer));

const handleLookup = async (
  request: Request,
  target: RdapLookupTarget,
  candidate: string,
  maxLength: number,
  serviceLayer: Layer.Layer<RdapService>,
  invalidMessage: string
): Promise<Response> => {
  if (candidate.length === 0 || candidate.length > maxLength) {
    return apiErrorResponse(
      "invalid-input",
      `The lookup value must contain between 1 and ${maxLength} characters.`,
      400
    );
  }

  if (parseRdapLookupTarget(target)._tag === "Err") {
    return apiErrorResponse("invalid-input", invalidMessage, 400);
  }

  return await respondWithApiEffect(
    request,
    RdapNormalizedRecordSchema,
    runLookup(target, serviceLayer),
    {
      cacheControl:
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    }
  );
};

/** Resolve an authoritative RDAP IP or CIDR record through the shared service.
 * @param request - Incoming API request for Accept negotiation.
 * @param input - Untrusted IPv4, IPv6, or CIDR path value.
 * @param serviceLayer - Optional service Layer used by isolated tests.
 * @returns A schema-validated public record or a stable API error response.
 */
export const handleRdapIpLookup = async (
  request: Request,
  input: string,
  serviceLayer: Layer.Layer<RdapService> = layerLive
): Promise<Response> => {
  const candidate = input.trim();

  return await handleLookup(
    request,
    { kind: "ip", address: candidate },
    candidate,
    MAX_IP_LOOKUP_LENGTH,
    serviceLayer,
    "Enter a valid IPv4 or IPv6 address, optionally followed by a CIDR prefix."
  );
};

/** Resolve an authoritative RDAP domain record through the shared service.
 * @param request - Incoming API request for Accept negotiation.
 * @param input - Untrusted internationalized or ASCII domain path value.
 * @param serviceLayer - Optional service Layer used by isolated tests.
 * @returns A schema-validated public record or a stable API error response.
 */
export const handleRdapDomainLookup = async (
  request: Request,
  input: string,
  serviceLayer: Layer.Layer<RdapService> = layerLive
): Promise<Response> => {
  const candidate = input.trim();

  return await handleLookup(
    request,
    { kind: "domain", domain: candidate },
    candidate,
    MAX_DOMAIN_LOOKUP_LENGTH,
    serviceLayer,
    "Enter a valid DNS domain name."
  );
};
