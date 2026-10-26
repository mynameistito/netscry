export { parseAsn } from "./asn.ts";

export type { Asn, AsnParseError } from "./asn.ts";

export { containsIpAddress, parseCidr } from "./cidr.ts";

export type { IpCidr, IpCidrParseError } from "./cidr.ts";

export { classifyIpAddress } from "./ip-classification.ts";

export type { IpClassification } from "./ip-classification.ts";

export { normalizeDomain } from "./domain.ts";

export type { DomainParseError } from "./domain.ts";

export { parsePublicLookupQuery } from "./lookup-query.ts";

export type {
  PublicLookupQuery,
  PublicLookupQueryError,
} from "./lookup-query.ts";

export { parseDnsRecordData, parseDnsTtl } from "./dns.ts";

export type {
  DnsAddressRecordData,
  DnsCaaRecordData,
  DnsMxRecordData,
  DnsRecordData,
  DnsRecordError,
  DnsRecordType,
  DnsSoaRecordData,
  DnsSrvRecordData,
  DnsTargetRecordData,
  DnsTxtRecordData,
} from "./dns.ts";

export { parseIpAddress, parseIpv4, parseIpv6 } from "./ip.ts";

export type { IpAddress, IpAddressParseError, IpVersion } from "./ip.ts";

export {
  calculateRttStatistics,
  formatBitsPerSecond,
  formatBytes,
  formatDistanceKilometers,
  formatMilliseconds,
  geographicDistanceKm,
} from "./network-utils.ts";

export type {
  GeographicCoordinate,
  NetworkUtilityError,
  RttStatistics,
} from "./network-utils.ts";

export { err, ok } from "./result.ts";

export type { Result } from "./result.ts";
