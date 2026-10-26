import { parsePublicLookupQuery } from "@netscry/core";

/** A valid, canonical destination selected by the shared lookup search. */
export type PublicLookupTarget =
  | { readonly kind: "ip" | "cidr"; readonly query: string }
  | { readonly kind: "asn" | "domain"; readonly query: string };

const assertUnreachable = (value: never): never => {
  throw new Error(`Unsupported public lookup: ${JSON.stringify(value)}`);
};

/** Build the same-origin detail path for a parsed lookup target.
 * @param target - Canonical public lookup target.
 * @returns An encoded route path for the matching detail view.
 */
export const getPublicLookupHref = (target: PublicLookupTarget): string => {
  switch (target.kind) {
    case "ip":
    case "cidr": {
      return `/ip/${encodeURIComponent(target.query)}`;
    }

    case "asn": {
      return `/asn/${encodeURIComponent(target.query)}`;
    }

    case "domain": {
      return `/domain/${encodeURIComponent(target.query)}`;
    }

    default: {
      return assertUnreachable(target);
    }
  }
};

/** Parse user text into a canonical target for the public lookup routes.
 * @param query - Search field text.
 * @returns The canonical IP, network, ASN, or domain target, or a safe error.
 */
export const resolvePublicLookupTarget = (
  query: string
):
  | { readonly _tag: "Ok"; readonly value: PublicLookupTarget }
  | { readonly _tag: "Err"; readonly message: string } => {
  const parsed = parsePublicLookupQuery(query);

  if (parsed._tag === "Err") {
    return {
      _tag: "Err",
      message: "Enter a valid IP address, network, ASN, or domain.",
    };
  }

  const { kind, query: canonicalQuery } = parsed.value;

  return {
    _tag: "Ok",
    value: { kind, query: canonicalQuery },
  };
};
