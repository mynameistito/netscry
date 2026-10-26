import { classifyIpAddress, parseCidr, parseIpAddress } from "@netscry/core";
import {
  PublicCidrLookupResponseSchema,
  PublicIpLookupResponseSchema,
} from "@netscry/schemas";
import { Effect } from "effect";

import { apiErrorResponse, respondWithApiEffect } from "./http.ts";

const MAX_IP_LOOKUP_INPUT_LENGTH = 128;
const INVALID_INPUT_CODE = "invalid-input" as const;

const classificationNotes = {
  unspecified: "This address is the unspecified address.",
  loopback: "This address is in a loopback range.",
  "private-use": "This address is in a private-use range.",
  shared: "This address is in a shared address range.",
  "link-local": "This address is in a link-local range.",
  documentation: "This address is in a documentation range.",
  benchmarking: "This address is in a benchmarking range.",
  multicast: "This address is in a multicast range.",
  "limited-broadcast": "This is the IPv4 limited-broadcast address.",
  reserved: "This address is in a reserved range.",
  "ipv4-mapped": "This is an IPv4-mapped IPv6 address.",
  "unique-local": "This address is in a unique-local IPv6 range.",
  "discard-only": "This address is in an IPv6 discard-only range.",
  transition: "This address is in an IPv6 transition range.",
  unclassified:
    "No selected special-purpose range matched; this does not prove global reachability.",
} satisfies Record<ReturnType<typeof classifyIpAddress>, string>;

/** Parse and classify a public IP or canonicalize a CIDR without using request metadata.
 * @param request - Incoming API request used for representation negotiation.
 * @param input - Untrusted address or CIDR path segment.
 * @returns A schema-validated local lookup result or a typed 400/406 response.
 */
export const handlePublicIpLookup = async (
  request: Request,
  input: string
): Promise<Response> => {
  const candidate = input.trim();

  if (candidate.length > MAX_IP_LOOKUP_INPUT_LENGTH) {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "The address or range is longer than the supported input limit.",
      400
    );
  }

  if (candidate.includes("/")) {
    const parsed = parseCidr(candidate);

    if (parsed._tag === "Err") {
      return apiErrorResponse(
        INVALID_INPUT_CODE,
        "Enter a valid IPv4 or IPv6 address range in CIDR notation.",
        400
      );
    }

    const { value } = parsed;

    return await respondWithApiEffect(
      request,
      PublicCidrLookupResponseSchema,
      Effect.succeed({
        kind: "cidr" as const,
        input: candidate,
        network: value.canonical,
        version: value.version,
        prefixLength: value.prefixLength,
        networkAddress: {
          address: value.networkAddress.canonical,
          version: value.version,
        },
        lastAddress: {
          address: value.lastAddress.canonical,
          version: value.version,
        },
        addressCount: value.addressCount.toString(),
        provenance: {
          source: "derived" as const,
          method: "canonical-cidr-arithmetic" as const,
        },
      }),
      {
        cacheControl:
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      }
    );
  }

  const parsed = parseIpAddress(candidate);

  if (parsed._tag === "Err") {
    return apiErrorResponse(
      INVALID_INPUT_CODE,
      "Enter a valid IPv4 or IPv6 address.",
      400
    );
  }

  const classification = classifyIpAddress(parsed.value);

  return await respondWithApiEffect(
    request,
    PublicIpLookupResponseSchema,
    Effect.succeed({
      kind: "address" as const,
      input: candidate,
      address: {
        address: parsed.value.canonical,
        version: parsed.value.version,
      },
      classification: {
        _tag: "Available" as const,
        source: "derived" as const,
        value: classification,
        sensitivity: "public" as const,
      },
      classificationNote: {
        _tag: "Available" as const,
        source: "derived" as const,
        value: classificationNotes[classification],
        sensitivity: "public" as const,
      },
      provenance: {
        source: "derived" as const,
        method: "selected-ip-purpose-ranges" as const,
      },
    }),
    {
      cacheControl:
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    }
  );
};
