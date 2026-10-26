import {
  containsIpAddress as rangeContains,
  err,
  normalizeDomain,
  ok,
  parseAsn,
  parseCidr,
  parseIpAddress,
} from "@netscry/core";
import type { Asn, IpAddress, IpCidr, Result } from "@netscry/core";
import type { RdapBootstrapRegistry } from "@netscry/schemas";

const HTTPS_SCHEME = "https:";

/** An untrusted RDAP lookup request accepted by the discovery functions. */
export type RdapLookupTarget =
  | {
      readonly kind: "ip";
      readonly address: string;
      readonly prefixLength?: number;
    }
  | { readonly kind: "asn"; readonly asn: string }
  | { readonly kind: "domain"; readonly domain: string };

/** A lookup target parsed into canonical values for matching and URL creation. */
export type CanonicalRdapTarget =
  | {
      readonly kind: "ip";
      readonly address: IpAddress;
      readonly cidr?: IpCidr;
      readonly prefixLength?: number;
    }
  | { readonly kind: "asn"; readonly asn: Asn }
  | { readonly kind: "domain"; readonly domain: string };

/** Expected invalid lookup target or missing safe bootstrap match. */
export type RdapBootstrapError =
  | { readonly _tag: "InvalidRdapLookupTarget" }
  | { readonly _tag: "RdapServiceNotFound" }
  | { readonly _tag: "NoSecureRdapServiceUrl" }
  | { readonly _tag: "InvalidRdapBaseUrl" };

/** A secure bootstrap match plus the canonical target used for the query. */
export interface RdapServiceDiscovery {
  readonly target: CanonicalRdapTarget;
  readonly baseUrls: readonly string[];
  readonly match: string;
  readonly publication: string;
}

const invalidTarget = (): RdapBootstrapError => ({
  _tag: "InvalidRdapLookupTarget",
});

/** Parse and normalize an IP, CIDR, ASN, or domain RDAP lookup target.
 * @param target - Untrusted address, range, autonomous system, or domain input.
 * @returns A canonical lookup target or a typed input error.
 */
export const parseRdapLookupTarget = (
  target: RdapLookupTarget
): Result<CanonicalRdapTarget, RdapBootstrapError> => {
  if (target.kind === "ip") {
    if (target.address.includes("/")) {
      const cidr = parseCidr(target.address);

      if (cidr._tag === "Err") {
        return err(invalidTarget());
      }

      return ok({
        kind: "ip",
        address: cidr.value.networkAddress,
        cidr: cidr.value,
        prefixLength: cidr.value.prefixLength,
      });
    }

    const address = parseIpAddress(target.address);

    if (address._tag === "Err") {
      return err(invalidTarget());
    }

    if (target.prefixLength !== undefined) {
      const bitLength = address.value.version === 4 ? 32 : 128;

      if (
        !Number.isInteger(target.prefixLength) ||
        target.prefixLength < 0 ||
        target.prefixLength > bitLength
      ) {
        return err(invalidTarget());
      }

      return ok({
        kind: "ip",
        address: address.value,
        prefixLength: target.prefixLength,
      });
    }

    return ok({ kind: "ip", address: address.value });
  }

  if (target.kind === "asn") {
    const asn = parseAsn(target.asn);

    return asn._tag === "Err"
      ? err(invalidTarget())
      : ok({ kind: "asn", asn: asn.value });
  }

  const domain = normalizeDomain(target.domain);

  return domain._tag === "Err"
    ? err(invalidTarget())
    : ok({ kind: "domain", domain: domain.value });
};

const isLocalHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname.endsWith(".local") ||
  hostname.endsWith(".internal");

const hasIpLiteralHost = (hostname: string) => {
  const hostWithoutBrackets = hostname.replaceAll(/^\[|\]$/gu, "");

  return parseIpAddress(hostWithoutBrackets)._tag === "Ok";
};

const secureBaseUrl = (input: string): string | undefined => {
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== HTTPS_SCHEME) {
      return undefined;
    }

    if (url.username !== "" || url.password !== "") {
      return undefined;
    }

    if (url.search !== "" || url.hash !== "" || !url.pathname.endsWith("/")) {
      return undefined;
    }

    if (hasIpLiteralHost(hostname) || isLocalHost(hostname)) {
      return undefined;
    }

    return url.href;
  } catch {
    return undefined;
  }
};

const secureBaseUrls = (urls: readonly string[]) => [
  ...new Set(urls.flatMap((url) => secureBaseUrl(url) ?? [])),
];

const ipMatches = (entry: string, address: IpAddress) => {
  const range = parseCidr(entry);

  return range._tag === "Ok" && range.value.version === address.version
    ? range.value
    : undefined;
};

const asnRange = (
  entry: string
): { readonly lower: number; readonly upper: number } | undefined => {
  const match = /^(?<first>\d+)-(?<last>\d+)$/u.exec(entry);
  const first = match?.groups?.first;
  const last = match?.groups?.last;

  if (first === undefined || last === undefined) {
    return undefined;
  }

  const lower = Number(first);
  const upper = Number(last);

  if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper)) {
    return undefined;
  }

  if (lower < 0 || upper > 4_294_967_295 || lower > upper) {
    return undefined;
  }

  return { lower, upper };
};

const domainMatches = (entry: string, domain: string) =>
  entry === "" || domain === entry || domain.endsWith(`.${entry}`);

const targetSpecificity = (
  entries: readonly string[],
  target: CanonicalRdapTarget
) => {
  if (target.kind === "ip") {
    let bestPrefixLength = -1;

    for (const entry of entries) {
      const range = ipMatches(entry, target.address);

      if (
        range !== undefined &&
        range.prefixLength > bestPrefixLength &&
        rangeContains(range, target.address)
      ) {
        bestPrefixLength = range.prefixLength;
      }
    }

    return bestPrefixLength;
  }

  if (target.kind === "asn") {
    const { value } = target.asn;

    return entries.some((entry) => {
      const range = asnRange(entry);

      return (
        range !== undefined && value >= range.lower && value <= range.upper
      );
    })
      ? 0
      : -1;
  }

  let bestLabelCount = -1;

  for (const entry of entries) {
    if (domainMatches(entry, target.domain)) {
      bestLabelCount = Math.max(
        bestLabelCount,
        entry === "" ? 0 : entry.split(".").length
      );
    }
  }

  return bestLabelCount;
};

const findMatchingEntry = (
  entries: readonly string[],
  target: CanonicalRdapTarget
): string | undefined => {
  let bestEntry: string | undefined;
  let bestSpecificity = -1;

  for (const entry of entries) {
    const specificity = targetSpecificity([entry], target);

    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      bestEntry = entry;
    }
  }

  return bestEntry;
};

/** Match the most-specific RFC 9224 IANA entry and retain secure service URLs.
 * @param registry - Schema-decoded IANA bootstrap registry.
 * @param lookup - Untrusted target to parse and match.
 * @returns Canonical target and secure matching bases, or a typed resolution error.
 */
export const discoverRdapService = (
  registry: RdapBootstrapRegistry,
  lookup: RdapLookupTarget
): Result<RdapServiceDiscovery, RdapBootstrapError> => {
  const parsed = parseRdapLookupTarget(lookup);

  if (parsed._tag === "Err") {
    return parsed;
  }

  const target = parsed.value;
  let bestSpecificity = -1;
  let matchingBaseUrls: string[] = [];
  let matchedEntry: string | undefined;

  for (const [entries, urls] of registry.services) {
    const specificity = targetSpecificity(entries, target);

    if (specificity < 0) {
      continue;
    }

    const bases = secureBaseUrls(urls);

    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      matchingBaseUrls = bases;
      matchedEntry = findMatchingEntry(entries, target);
    } else if (specificity === bestSpecificity) {
      matchingBaseUrls.push(...bases);
    }
  }

  if (bestSpecificity < 0) {
    return err({ _tag: "RdapServiceNotFound" });
  }

  const baseUrls = [...new Set(matchingBaseUrls)];

  if (baseUrls.length === 0) {
    return err({ _tag: "NoSecureRdapServiceUrl" });
  }

  return ok({
    target,
    baseUrls,
    match: matchedEntry ?? "",
    publication: registry.publication,
  });
};

/** Build an RFC 9082 query URL under a validated HTTPS bootstrap base.
 * @param baseUrl - Candidate RDAP base selected from an IANA bootstrap entry.
 * @param lookup - An untrusted lookup target to parse before URL construction.
 * @returns A secure query URL or a typed target/base error.
 */
export const buildRdapQueryUrl = (
  baseUrl: string,
  lookup: RdapLookupTarget
): Result<URL, RdapBootstrapError> => {
  const parsed = parseRdapLookupTarget(lookup);

  if (parsed._tag === "Err") {
    return parsed;
  }

  const target = parsed.value;
  const base = secureBaseUrl(baseUrl);

  if (base === undefined) {
    return err({ _tag: "InvalidRdapBaseUrl" });
  }

  let path: string;

  if (target.kind === "ip") {
    path = `ip/${target.address.canonical}`;

    if (target.prefixLength !== undefined) {
      path = `${path}/${target.prefixLength}`;
    }
  } else if (target.kind === "asn") {
    path = `autnum/${target.asn.value}`;
  } else {
    path = `domain/${target.domain}`;
  }

  try {
    const url = new URL(path, base);

    return url.origin === new URL(base).origin
      ? ok(url)
      : err({ _tag: "InvalidRdapBaseUrl" });
  } catch {
    return err({ _tag: "InvalidRdapBaseUrl" });
  }
};
