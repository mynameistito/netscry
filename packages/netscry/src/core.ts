export { parseAsn } from "@netscry/core";

export type { Asn, AsnParseError } from "@netscry/core";

export { containsIpAddress, parseCidr } from "@netscry/core";

export type { IpCidr, IpCidrParseError } from "@netscry/core";

export { classifyIpAddress } from "@netscry/core";

export type { IpClassification } from "@netscry/core";

export { normalizeDomain } from "@netscry/core";

export type { DomainParseError } from "@netscry/core";

export { parsePublicLookupQuery } from "@netscry/core";

export type { PublicLookupQuery, PublicLookupQueryError } from "@netscry/core";

export { parseDnsRecordData, parseDnsTtl } from "@netscry/core";

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
} from "@netscry/core";

export { parseIpAddress, parseIpv4, parseIpv6 } from "@netscry/core";

export type { IpAddress, IpAddressParseError, IpVersion } from "@netscry/core";

export {
  calculateRttStatistics,
  formatBitsPerSecond,
  formatBytes,
  formatDistanceKilometers,
  formatMilliseconds,
  geographicDistanceKm,
} from "@netscry/core";

export type {
  GeographicCoordinate,
  NetworkUtilityError,
  RttStatistics,
} from "@netscry/core";

export { err, ok } from "@netscry/core";

export type { Result } from "@netscry/core";
