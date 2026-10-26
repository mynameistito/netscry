import { parseAsn } from "./asn.js";
import { parseCidr } from "./cidr.js";
import { normalizeDomain } from "./domain.js";
import { parseIpAddress } from "./ip.js";
import { err, ok } from "./result.js";
import type { Result } from "./result.js";

/** Parsed address or prefix lookup query. */
type AddressLookupQuery =
  | { readonly kind: "ip"; readonly query: string }
  | { readonly kind: "cidr"; readonly query: string };

/** Parsed ASN or domain query. */
type NamedLookupQuery =
  | { readonly kind: "asn"; readonly query: string; readonly value: number }
  | { readonly kind: "domain"; readonly query: string };

/** Tagged union of supported public lookup targets. */
export type PublicLookupQuery = AddressLookupQuery | NamedLookupQuery;

/** Expected classification failures for public lookup input. */
export interface PublicLookupQueryError {
  readonly _tag: "InvalidPublicLookupQuery";
  readonly reason: "Empty" | "Invalid";
}

const invalidQuery = (
  reason: PublicLookupQueryError["reason"]
): Result<never, PublicLookupQueryError> =>
  err({ _tag: "InvalidPublicLookupQuery", reason });

/**
 * Classify and normalize IP, CIDR, ASN, and domain lookup text.
 *
 * IP forms are checked before ASNs so dotted IPv4 text cannot be mistaken for
 * a numeric autonomous system number. CIDRs retain their network bounds in
 * canonical form, while ASNs and internationalized domains are normalized.
 *
 * @param input - User-entered lookup text.
 * @returns A normalized lookup target or a structured parse failure.
 */
export const parsePublicLookupQuery = (
  input: string
): Result<PublicLookupQuery, PublicLookupQueryError> => {
  const query = input.trim();

  if (query.length === 0) {
    return invalidQuery("Empty");
  }

  if (query.includes("/")) {
    if (query.includes("://")) {
      return invalidQuery("Invalid");
    }

    const cidr = parseCidr(query);

    return cidr._tag === "Ok"
      ? ok({ kind: "cidr", query: cidr.value.canonical })
      : invalidQuery("Invalid");
  }

  const address = parseIpAddress(query);

  if (address._tag === "Ok") {
    return ok({ kind: "ip", query: address.value.canonical });
  }

  const asn = parseAsn(query);

  if (asn._tag === "Ok") {
    return ok({
      kind: "asn",
      query: asn.value.canonical,
      value: asn.value.value,
    });
  }

  if (/^(?:AS|\d+$)/iu.test(query)) {
    return invalidQuery("Invalid");
  }

  if (
    (/^[\da-f:]+$/iu.test(query) && query.includes(":")) ||
    /^\d+(?:\.\d+){3}$/u.test(query)
  ) {
    return invalidQuery("Invalid");
  }

  const domain = normalizeDomain(query);

  return domain._tag === "Ok"
    ? ok({ kind: "domain", query: domain.value })
    : invalidQuery("Invalid");
};
