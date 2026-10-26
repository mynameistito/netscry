import { parseIpAddress } from "./ip.js";
import type { IpAddress, IpVersion } from "./ip.js";
import { err, ok } from "./result.js";
import type { Result } from "./result.js";

/** A parsed network range with normalized network and final addresses. */
export interface IpCidr {
  readonly version: IpVersion;
  readonly prefixLength: number;
  readonly canonical: string;
  readonly networkAddress: IpAddress;
  readonly lastAddress: IpAddress;
  readonly addressCount: bigint;
}

/** An expected failure while parsing a CIDR string. */
export interface IpCidrParseError {
  readonly _tag: "InvalidIpCidr";
  readonly reason:
    | "InvalidCidrSyntax"
    | "InvalidIpAddress"
    | "InvalidPrefixLength";
}

const invalidCidr = (
  reason: IpCidrParseError["reason"]
): Result<never, IpCidrParseError> => err({ _tag: "InvalidIpCidr", reason });

const toInteger = (bytes: readonly number[]) =>
  bytes.reduce((value, byte) => value * 256n + BigInt(byte), 0n);

const fromInteger = (version: IpVersion, value: bigint): IpAddress => {
  const byteLength = version === 4 ? 4 : 16;

  const bytes = Array.from({ length: byteLength }, (_, index) =>
    Number((value / 256n ** BigInt(byteLength - index - 1)) % 256n)
  );

  const input =
    version === 4
      ? bytes.join(".")
      : Array.from({ length: 8 }, (_, index) =>
          (
            (bytes[index * 2] ?? 0) * 256 +
            (bytes[index * 2 + 1] ?? 0)
          ).toString(16)
        ).join(":");

  const parsed = parseIpAddress(input);

  if (parsed._tag === "Err") {
    throw new Error("CIDR address conversion produced invalid IP bytes");
  }

  return parsed.value;
};

/**
 * Parse an IPv4 or IPv6 CIDR and calculate its canonical network range.
 *
 * @param input - CIDR text such as `192.0.2.129/24` or `2001:db8::/32`.
 * @returns The normalized range, or a structured CIDR parsing failure.
 */
export const parseCidr = (input: string): Result<IpCidr, IpCidrParseError> => {
  const separator = input.indexOf("/");

  if (
    separator < 1 ||
    separator !== input.lastIndexOf("/") ||
    !/^\d+$/u.test(input.slice(separator + 1))
  ) {
    return invalidCidr("InvalidCidrSyntax");
  }

  const parsedAddress = parseIpAddress(input.slice(0, separator));

  if (parsedAddress._tag === "Err") {
    return invalidCidr("InvalidIpAddress");
  }

  const address = parsedAddress.value;
  const prefixLength = Number(input.slice(separator + 1));
  const bitLength = address.bytes.length * 8;

  if (
    !Number.isSafeInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > bitLength
  ) {
    return invalidCidr("InvalidPrefixLength");
  }

  const hostBitLength = BigInt(bitLength - prefixLength);
  const addressCount = 2n ** hostBitLength;
  const addressInteger = toInteger(address.bytes);
  const networkInteger = (addressInteger / addressCount) * addressCount;
  const lastInteger = networkInteger + addressCount - 1n;
  const networkAddress = fromInteger(address.version, networkInteger);
  const lastAddress = fromInteger(address.version, lastInteger);

  return ok({
    version: address.version,
    prefixLength,
    canonical: `${networkAddress.canonical}/${prefixLength}`,
    networkAddress,
    lastAddress,
    addressCount,
  });
};

/**
 * Check whether a parsed address is inside a parsed CIDR range.
 *
 * @param cidr - The parsed range to test.
 * @param address - The parsed address to check.
 * @returns Whether the address falls within the range, inclusive of both bounds.
 */
export const containsIpAddress = (cidr: IpCidr, address: IpAddress) => {
  if (cidr.version !== address.version) {
    return false;
  }

  const integer = toInteger(address.bytes);

  return (
    integer >= toInteger(cidr.networkAddress.bytes) &&
    integer <= toInteger(cidr.lastAddress.bytes)
  );
};
