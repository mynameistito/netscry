import { normalizeDomain, parseIpAddress } from "@netscry/core";
import { DnsLookupResponseSchema, DnsRecordTypeSchema } from "@netscry/schemas";
import type { DnsRecordType } from "@netscry/schemas";
import { Effect, Schema } from "effect";
import type { Layer } from "effect";

import { DnsService, layerLive } from "../services/dns.ts";
import { apiErrorResponse, respondWithApiEffect } from "./http.ts";

const MAX_DNS_QUERY_LENGTH = 254;
const DEFAULT_DNS_RECORD_TYPE = "A";
const INVALID_INPUT_STATUS = 400;
const INVALID_INPUT_CODE = "invalid-input" as const;

const parseRecordType = (request: Request): DnsRecordType | undefined => {
  const parameters = new URL(request.url).searchParams.getAll("type");

  if (parameters.length > 1) {
    return undefined;
  }

  const candidate = parameters[0] ?? DEFAULT_DNS_RECORD_TYPE;

  const decoded = Schema.decodeUnknownResult(DnsRecordTypeSchema)(
    candidate.toUpperCase()
  );

  return decoded._tag === "Success" ? decoded.success : undefined;
};

const isValidDnsQuery = (query: string, recordType: DnsRecordType) => {
  if (recordType === "PTR" && parseIpAddress(query)._tag === "Ok") {
    return true;
  }

  return normalizeDomain(query)._tag === "Ok";
};

const runLookup = (
  query: string,
  recordType: typeof DnsRecordTypeSchema.Type,
  serviceLayer: Layer.Layer<DnsService>
) =>
  Effect.gen(function* lookup() {
    const service = yield* DnsService;

    return yield* service.lookup(query, recordType);
  }).pipe(Effect.provide(serviceLayer));

/** Resolve a DNS record through the public DNS lookup service.
 * @param request - Incoming API request for Accept negotiation and type query.
 * @param input - Untrusted domain, reverse-DNS name, or PTR address.
 * @param serviceLayer - Optional service Layer used by isolated tests.
 * @returns A schema-validated DNS answer or a stable API error response.
 */
export const handleDnsLookup = async (
  request: Request,
  input: string,
  serviceLayer: Layer.Layer<DnsService> = layerLive
): Promise<Response> => {
  const query = input.trim();

  if (query.length === 0 || query.length > MAX_DNS_QUERY_LENGTH) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      `The DNS query must contain between 1 and ${MAX_DNS_QUERY_LENGTH} characters.`,
      INVALID_INPUT_STATUS
    );
  }

  const recordType = parseRecordType(request);

  if (recordType === undefined) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "Choose one supported DNS record type in the type query parameter.",
      INVALID_INPUT_STATUS
    );
  }

  if (!isValidDnsQuery(query, recordType)) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "Enter a valid DNS name, or an IPv4/IPv6 address for a PTR lookup.",
      INVALID_INPUT_STATUS
    );
  }

  return await respondWithApiEffect(
    request,
    DnsLookupResponseSchema,
    runLookup(query, recordType, serviceLayer),
    {
      cacheControlFor: (response) => {
        const ttl = Math.min(response.cacheTtlSeconds ?? 0, 60);

        return ttl === 0
          ? "no-store"
          : `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=0`;
      },
    }
  );
};
