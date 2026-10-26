export { parseAsn } from "./asn.js";

export type { Asn, AsnParseError } from "./asn.js";

export { containsIpAddress, parseCidr } from "./cidr.js";

export type { IpCidr, IpCidrParseError } from "./cidr.js";

export { classifyIpAddress } from "./ip-classification.js";

export type { IpClassification } from "./ip-classification.js";

export { normalizeDomain } from "./domain.js";

export type { DomainParseError } from "./domain.js";

export { parsePublicLookupQuery } from "./lookup-query.js";

export type {
  PublicLookupQuery,
  PublicLookupQueryError,
} from "./lookup-query.js";

export { parseDnsRecordData, parseDnsTtl } from "./dns.js";

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
} from "./dns.js";

export { parseIpAddress, parseIpv4, parseIpv6 } from "./ip.js";

export type { IpAddress, IpAddressParseError, IpVersion } from "./ip.js";

export {
  calculateRttStatistics,
  formatBitsPerSecond,
  formatBytes,
  formatDistanceKilometers,
  formatMilliseconds,
  geographicDistanceKm,
} from "./network-utils.js";

export type {
  GeographicCoordinate,
  NetworkUtilityError,
  RttStatistics,
} from "./network-utils.js";

export { err, ok } from "./result.js";

export type { Result } from "./result.js";
