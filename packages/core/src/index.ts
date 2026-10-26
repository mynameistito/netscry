export { containsIpAddress, parseCidr } from "./cidr.ts";

export type { IpCidr, IpCidrParseError } from "./cidr.ts";

export { classifyIpAddress } from "./ip-classification.ts";

export type { IpClassification } from "./ip-classification.ts";

export { parseIpAddress, parseIpv4, parseIpv6 } from "./ip.ts";

export type { IpAddress, IpAddressParseError, IpVersion } from "./ip.ts";

export { err, ok } from "./result.ts";

export type { Result } from "./result.ts";
