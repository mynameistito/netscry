import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";

const ASN_PATTERN = /^(?:AS)?(?<digits>\d+)$/iu;
const MAX_ASN = 4_294_967_295;

/** A normalized autonomous system number. */
export interface Asn {
  readonly value: number;
  readonly canonical: string;
}

/** An expected failure while parsing an autonomous system number. */
export interface AsnParseError {
  readonly _tag: "InvalidAsn";
  readonly reason: "InvalidSyntax" | "ReservedValue" | "OutOfRange";
}

const invalidAsn = (
  reason: AsnParseError["reason"]
): Result<never, AsnParseError> => err({ _tag: "InvalidAsn", reason });

/**
 * Parse and normalize a 32-bit AS number with an optional `AS` prefix.
 *
 * @param input - Numeric or AS-prefixed text.
 * @returns The canonical AS number, or a structured parsing failure.
 */
export const parseAsn = (input: string): Result<Asn, AsnParseError> => {
  const match = ASN_PATTERN.exec(input.trim());

  if (match === null) {
    return invalidAsn("InvalidSyntax");
  }

  const digits = match.groups?.digits;

  if (digits === undefined) {
    return invalidAsn("InvalidSyntax");
  }

  const value = Number(digits);

  if (!Number.isSafeInteger(value) || value > MAX_ASN) {
    return invalidAsn("OutOfRange");
  }

  if (value === 0 || value === MAX_ASN) {
    return invalidAsn("ReservedValue");
  }

  return ok({ value, canonical: `AS${value}` });
};
