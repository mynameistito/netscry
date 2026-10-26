// oxlint-disable sonarjs/no-hardcoded-ip -- These are IANA classification prefixes, never network destinations.
import { containsIpAddress, parseCidr } from "./cidr.ts";
import type { IpCidr } from "./cidr.ts";
import type { IpAddress } from "./ip.ts";

/** A known address-purpose category, not a guarantee of network reachability. */
export type IpClassification =
  | "unspecified"
  | "loopback"
  | "private-use"
  | "shared"
  | "link-local"
  | "documentation"
  | "benchmarking"
  | "multicast"
  | "limited-broadcast"
  | "reserved"
  | "ipv4-mapped"
  | "unique-local"
  | "discard-only"
  | "transition"
  | "unclassified";

interface ClassificationRule {
  readonly cidr: string;
  readonly classification: Exclude<IpClassification, "unclassified">;
}

interface ParsedClassificationRule {
  readonly range: IpCidr;
  readonly classification: Exclude<IpClassification, "unclassified">;
}

const PRIVATE_USE = "private-use" as const;

const CLASSIFICATION_RULES: readonly ClassificationRule[] = [
  { cidr: "0.0.0.0/32", classification: "unspecified" },
  { cidr: "0.0.0.0/8", classification: "reserved" },
  { cidr: "10.0.0.0/8", classification: PRIVATE_USE },
  { cidr: "100.64.0.0/10", classification: "shared" },
  { cidr: "127.0.0.0/8", classification: "loopback" },
  { cidr: "169.254.0.0/16", classification: "link-local" },
  { cidr: "172.16.0.0/12", classification: PRIVATE_USE },
  { cidr: "192.0.2.0/24", classification: "documentation" },
  { cidr: "198.18.0.0/15", classification: "benchmarking" },
  { cidr: "198.51.100.0/24", classification: "documentation" },
  { cidr: "203.0.113.0/24", classification: "documentation" },
  { cidr: "192.168.0.0/16", classification: PRIVATE_USE },
  { cidr: "224.0.0.0/4", classification: "multicast" },
  { cidr: "255.255.255.255/32", classification: "limited-broadcast" },
  { cidr: "240.0.0.0/4", classification: "reserved" },
  { cidr: "::/128", classification: "unspecified" },
  { cidr: "::1/128", classification: "loopback" },
  { cidr: "::ffff:0:0/96", classification: "ipv4-mapped" },
  { cidr: "100::/64", classification: "discard-only" },
  { cidr: "2001:2::/48", classification: "benchmarking" },
  { cidr: "2001:db8::/32", classification: "documentation" },
  { cidr: "3fff::/20", classification: "documentation" },
  { cidr: "2002::/16", classification: "transition" },
  { cidr: "fc00::/7", classification: "unique-local" },
  { cidr: "fe80::/10", classification: "link-local" },
  { cidr: "ff00::/8", classification: "multicast" },
];

const parseClassificationRules = (): readonly ParsedClassificationRule[] => {
  const parsedRules: ParsedClassificationRule[] = [];

  for (const rule of CLASSIFICATION_RULES) {
    const parsed = parseCidr(rule.cidr);

    if (parsed._tag === "Err") {
      throw new Error(
        `Invalid built-in CIDR classification range: ${rule.cidr}`
      );
    }

    parsedRules.push({
      range: parsed.value,
      classification: rule.classification,
    });
  }

  return parsedRules;
};

const parsedRules = parseClassificationRules();

/**
 * Classify an address against selected IANA special-purpose ranges.
 * “Unclassified” does not mean globally reachable or public.
 *
 * @param address - A previously parsed IPv4 or IPv6 address.
 * @returns Its recognized purpose category, or `unclassified`.
 */
export const classifyIpAddress = (address: IpAddress): IpClassification => {
  for (const rule of parsedRules) {
    if (containsIpAddress(rule.range, address)) {
      return rule.classification;
    }
  }

  return "unclassified";
};
