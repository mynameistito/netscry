import { parseIpAddress } from "./ip.ts";
import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";

const DOMAIN_LABEL = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)$/u;

const FORBIDDEN_DOMAIN_CHARACTERS = new Set([
  "/",
  "?",
  "#",
  "@",
  ":",
  "[",
  "]",
  "\\",
  "%",
]);

/** An expected failure while normalizing a DNS domain name. */
export interface DomainParseError {
  readonly _tag: "InvalidDomain";
  readonly reason: "InvalidSyntax" | "InvalidDomainName" | "IpAddress";
}

const invalidDomain = (
  reason: DomainParseError["reason"]
): Result<never, DomainParseError> => err({ _tag: "InvalidDomain", reason });

const hasInvalidDomainCharacters = (value: string) => {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (
      FORBIDDEN_DOMAIN_CHARACTERS.has(character) ||
      (codePoint !== undefined && (codePoint <= 32 || codePoint === 127))
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Normalize a domain name to lowercase ASCII using the platform URL IDNA parser.
 * A single final root dot is removed from the returned lookup form.
 *
 * @param input - A domain name, optionally containing Unicode IDN labels.
 * @returns The canonical ASCII domain or a structured parsing failure.
 */
export const normalizeDomain = (
  input: string
): Result<string, DomainParseError> => {
  const candidate = input.trim();

  if (candidate === "") {
    return invalidDomain("InvalidSyntax");
  }

  if (hasInvalidDomainCharacters(candidate)) {
    return invalidDomain("InvalidSyntax");
  }

  let hostname: string;

  try {
    hostname = new URL(`http://${candidate}/`).hostname.toLowerCase();
  } catch {
    return invalidDomain("InvalidDomainName");
  }

  const canonical = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;

  if (canonical.length > 253) {
    return invalidDomain("InvalidDomainName");
  }

  if (parseIpAddress(canonical)._tag === "Ok") {
    return invalidDomain("IpAddress");
  }

  const labels = canonical.split(".");

  if (labels.some((label) => label.length > 63 || !DOMAIN_LABEL.test(label))) {
    return invalidDomain("InvalidDomainName");
  }

  return ok(canonical);
};
