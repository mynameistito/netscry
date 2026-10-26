import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";

/** IP address family number used by network protocols. */
export type IpVersion = 4 | 6;

/** The normalized value and packed bytes of a valid IP address. */
export interface IpAddress {
  readonly version: IpVersion;
  readonly canonical: string;
  readonly bytes: readonly number[];
}

/** A structured expected failure from parsing invalid IP text. */
export interface IpAddressParseError {
  readonly _tag: "InvalidIpAddress";
  readonly version: IpVersion;
  readonly reason:
    | "InvalidAddressSyntax"
    | "InvalidGroupCount"
    | "InvalidGroupValue";
}

type ParsedGroups = Result<readonly number[], IpAddressParseError>;

const invalidAddress = (
  version: IpVersion,
  reason: IpAddressParseError["reason"]
) => err<IpAddressParseError>({ _tag: "InvalidIpAddress", version, reason });

const parseIpv4Octets = (input: string): readonly number[] | undefined => {
  const parts = input.split(".");

  if (parts.length !== 4) {
    return undefined;
  }

  const octets: number[] = [];

  for (const part of parts) {
    if (!/^(?:0|[1-9]\d{0,2})$/u.test(part)) {
      return undefined;
    }

    const octet = Number(part);

    if (octet > 255) {
      return undefined;
    }

    octets.push(octet);
  }

  return octets;
};

/** Parse a strict dotted decimal IPv4 address into canonical text and bytes.
 *
 * @param input - Candidate IPv4 text.
 * @returns The normalized address or a parsing error.
 */
export const parseIpv4 = (
  input: string
): Result<IpAddress, IpAddressParseError> => {
  const octets = parseIpv4Octets(input);

  if (!octets) {
    return invalidAddress(4, "InvalidAddressSyntax");
  }

  return ok({ version: 4, canonical: octets.join("."), bytes: octets });
};

const parseIpv6Side = (input: string, allowIpv4Tail: boolean): ParsedGroups => {
  if (input === "") {
    return ok([]);
  }

  const tokens = input.split(":");
  const groups: number[] = [];

  for (const [index, token] of tokens.entries()) {
    if (token.includes(".")) {
      const isLastToken = index === tokens.length - 1;

      const octets =
        allowIpv4Tail && isLastToken ? parseIpv4Octets(token) : undefined;

      if (!octets) {
        return invalidAddress(6, "InvalidGroupValue");
      }

      groups.push(
        (octets[0] ?? 0) * 256 + (octets[1] ?? 0),
        (octets[2] ?? 0) * 256 + (octets[3] ?? 0)
      );
      continue;
    }

    if (!/^[\da-fA-F]{1,4}$/u.test(token)) {
      return invalidAddress(6, "InvalidGroupValue");
    }

    groups.push(Number.parseInt(token, 16));
  }

  return ok(groups);
};

const canonicalizeIpv6 = (groups: readonly number[]): string => {
  let bestStart = -1;
  let bestLength = 1;

  for (let index = 0; index < groups.length;) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }

    let end = index + 1;

    while (end < groups.length && groups[end] === 0) {
      end += 1;
    }

    const length = end - index;

    if (length > bestLength) {
      bestStart = index;
      bestLength = length;
    }

    index = end;
  }

  if (bestStart === -1) {
    return groups.map((group) => group.toString(16)).join(":");
  }

  const before = groups
    .slice(0, bestStart)
    .map((group) => group.toString(16))
    .join(":");

  const after = groups
    .slice(bestStart + bestLength)
    .map((group) => group.toString(16))
    .join(":");

  return `${before}::${after}`;
};

/** Parse IPv6, including an optional final dotted-decimal IPv4 tail.
 *
 * @param input - Candidate IPv6 text.
 * @returns The normalized address or a parsing error.
 */
export const parseIpv6 = (
  input: string
): Result<IpAddress, IpAddressParseError> => {
  if (input === "" || input.includes("%")) {
    return invalidAddress(6, "InvalidAddressSyntax");
  }

  const compressionIndex = input.indexOf("::");

  if (compressionIndex !== -1 && input.includes("::", compressionIndex + 2)) {
    return invalidAddress(6, "InvalidAddressSyntax");
  }

  const hasCompression = compressionIndex !== -1;
  const leftInput = hasCompression ? input.slice(0, compressionIndex) : input;
  const rightInput = hasCompression ? input.slice(compressionIndex + 2) : "";

  const leftResult = parseIpv6Side(
    leftInput,
    !hasCompression && rightInput === ""
  );

  const rightResult = hasCompression ? parseIpv6Side(rightInput, true) : ok([]);

  if (leftResult._tag === "Err") {
    return leftResult;
  }

  if (rightResult._tag === "Err") {
    return rightResult;
  }

  const leftGroups = leftResult.value;
  const rightGroups = rightResult.value;
  const missingGroups = 8 - leftGroups.length - rightGroups.length;

  if (
    (hasCompression && missingGroups < 1) ||
    (!hasCompression && missingGroups !== 0)
  ) {
    return invalidAddress(6, "InvalidGroupCount");
  }

  const groups = [
    ...leftGroups,
    ...Array.from({ length: Math.max(0, missingGroups) }, () => 0),
    ...rightGroups,
  ];

  const bytes = groups.flatMap((group) => [
    Math.floor(group / 256),
    group % 256,
  ]);

  return ok({ version: 6, canonical: canonicalizeIpv6(groups), bytes });
};

/** Parse IPv4 or IPv6 input and return its canonical textual form.
 *
 * @param input - Candidate IP address text.
 * @returns The normalized address or a parsing error.
 */
export const parseIpAddress = (
  input: string
): Result<IpAddress, IpAddressParseError> =>
  input.includes(":") ? parseIpv6(input) : parseIpv4(input);
