import { normalizeDomain } from "./domain.ts";
import { parseIpAddress } from "./ip.ts";
import type { IpAddress } from "./ip.ts";
import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";

const CAA_ESCAPED_CHARACTER = /\\(?<escaped>.)/gu;
const UINT32_MAX = 4_294_967_295;
const UINT16_MAX = 65_535;

/** DNS resource record types supported by the lookup interface. */
export type DnsRecordType =
  | "A"
  | "AAAA"
  | "CAA"
  | "CNAME"
  | "MX"
  | "NS"
  | "PTR"
  | "SOA"
  | "SRV"
  | "TXT";

/** Normalized A or AAAA record data. */
export interface DnsAddressRecordData {
  readonly type: "A" | "AAAA";
  readonly address: IpAddress;
}

/** Normalized alias, name-server, or reverse-pointer record data. */
export interface DnsTargetRecordData {
  readonly type: "CNAME" | "NS" | "PTR";
  readonly target: string;
}

/** Normalized mail-exchange record data. */
export interface DnsMxRecordData {
  readonly type: "MX";
  readonly preference: number;
  readonly exchange: string;
}

/** Normalized text record data. */
export interface DnsTxtRecordData {
  readonly type: "TXT";
  readonly text: string;
}

/** Normalized start-of-authority record data. */
export interface DnsSoaRecordData {
  readonly type: "SOA";
  readonly mname: string;
  readonly rname: string;
  readonly serial: number;
  readonly refresh: number;
  readonly retry: number;
  readonly expire: number;
  readonly minimum: number;
}

/** Normalized certificate-authority authorization record data. */
export interface DnsCaaRecordData {
  readonly type: "CAA";
  readonly flags: number;
  readonly tag: string;
  readonly value: string;
}

/** Normalized service-location record data. */
export interface DnsSrvRecordData {
  readonly type: "SRV";
  readonly priority: number;
  readonly weight: number;
  readonly port: number;
  readonly target: string;
}

/** Parsed DNS RDATA supported by the public lookup UI. */
export type DnsRecordData =
  | DnsAddressRecordData
  | DnsTargetRecordData
  | DnsMxRecordData
  | DnsTxtRecordData
  | DnsSoaRecordData
  | DnsCaaRecordData
  | DnsSrvRecordData;

/** An expected DNS record parsing or TTL failure. */
export interface DnsRecordError {
  readonly _tag: "InvalidDnsRecord";
  readonly reason: "InvalidRecordType" | "InvalidRecordData" | "InvalidTtl";
}

const invalidRecord = (
  reason: DnsRecordError["reason"]
): Result<never, DnsRecordError> => err({ _tag: "InvalidDnsRecord", reason });

const parseUnsignedInteger = (input: string, maximum: number) => {
  if (!/^\d+$/u.test(input)) {
    return null;
  }

  const value = Number(input);

  return Number.isSafeInteger(value) && value <= maximum ? value : null;
};

const parseSoaCounters = (fields: readonly string[]) => {
  if (fields.length !== 5) {
    return null;
  }

  const [serial, refresh, retry, expire, minimum] = fields;
  const serialValue = parseUnsignedInteger(serial ?? "", UINT32_MAX);

  if (serialValue === null) {
    return null;
  }

  const refreshValue = parseUnsignedInteger(refresh ?? "", UINT32_MAX);

  if (refreshValue === null) {
    return null;
  }

  const retryValue = parseUnsignedInteger(retry ?? "", UINT32_MAX);

  if (retryValue === null) {
    return null;
  }

  const expireValue = parseUnsignedInteger(expire ?? "", UINT32_MAX);

  if (expireValue === null) {
    return null;
  }

  const minimumValue = parseUnsignedInteger(minimum ?? "", UINT32_MAX);

  if (minimumValue === null) {
    return null;
  }

  return {
    serial: serialValue,
    refresh: refreshValue,
    retry: retryValue,
    expire: expireValue,
    minimum: minimumValue,
  };
};

const parseDomainTarget = (input: string) =>
  input === "." ? ok(".") : normalizeDomain(input);

const parseAddressData = (
  type: "A" | "AAAA",
  data: string
): Result<DnsAddressRecordData, DnsRecordError> => {
  const parsed = parseIpAddress(data);

  if (
    parsed._tag === "Err" ||
    (type === "A") !== (parsed.value.version === 4)
  ) {
    return invalidRecord("InvalidRecordData");
  }

  return ok({ type, address: parsed.value });
};

const parseTargetData = (
  type: DnsTargetRecordData["type"],
  data: string
): Result<DnsTargetRecordData, DnsRecordError> => {
  const target = parseDomainTarget(data);

  return target._tag === "Ok"
    ? ok({ type, target: target.value })
    : invalidRecord("InvalidRecordData");
};

const parseMxData = (data: string): Result<DnsMxRecordData, DnsRecordError> => {
  const fields = data.trim().split(/\s+/u);
  const [preference, exchange] = fields;

  if (
    fields.length !== 2 ||
    preference === undefined ||
    exchange === undefined
  ) {
    return invalidRecord("InvalidRecordData");
  }

  const parsedPreference = parseUnsignedInteger(preference, UINT16_MAX);
  const parsedExchange = parseDomainTarget(exchange);

  if (parsedPreference === null || parsedExchange._tag === "Err") {
    return invalidRecord("InvalidRecordData");
  }

  return ok({
    type: "MX",
    preference: parsedPreference,
    exchange: parsedExchange.value,
  });
};

const parseSrvData = (
  data: string
): Result<DnsSrvRecordData, DnsRecordError> => {
  const fields = data.trim().split(/\s+/u);

  if (fields.length !== 4) {
    return invalidRecord("InvalidRecordData");
  }

  const [priority, weight, port, target] = fields;
  const priorityInput = priority ?? "";
  const weightInput = weight ?? "";
  const portInput = port ?? "";
  const targetInput = target ?? "";

  const parsedPriority = parseUnsignedInteger(priorityInput, UINT16_MAX);
  const parsedWeight = parseUnsignedInteger(weightInput, UINT16_MAX);
  const parsedPort = parseUnsignedInteger(portInput, UINT16_MAX);
  const parsedTarget = parseDomainTarget(targetInput);

  if (
    parsedPriority === null ||
    parsedWeight === null ||
    parsedPort === null ||
    parsedTarget._tag === "Err"
  ) {
    return invalidRecord("InvalidRecordData");
  }

  return ok({
    type: "SRV",
    priority: parsedPriority,
    weight: parsedWeight,
    port: parsedPort,
    target: parsedTarget.value,
  });
};

const parseSoaData = (
  data: string
): Result<DnsSoaRecordData, DnsRecordError> => {
  const fields = data.trim().split(/\s+/u);

  if (fields.length !== 7) {
    return invalidRecord("InvalidRecordData");
  }

  const [mname, rname, ...counterFields] = fields;

  if (mname === undefined || rname === undefined) {
    return invalidRecord("InvalidRecordData");
  }

  const parsedMname = parseDomainTarget(mname);
  const parsedRname = parseDomainTarget(rname);

  if (parsedMname._tag === "Err" || parsedRname._tag === "Err") {
    return invalidRecord("InvalidRecordData");
  }

  const counters = parseSoaCounters(counterFields);

  if (counters === null) {
    return invalidRecord("InvalidRecordData");
  }

  return ok({
    type: "SOA",
    mname: parsedMname.value,
    rname: parsedRname.value,
    ...counters,
  });
};

const parseCaaData = (
  data: string
): Result<DnsCaaRecordData, DnsRecordError> => {
  const trimmedData = data.trim();
  const [flagsText, ...tagAndValue] = trimmedData.split(/\s+/u);
  const [tag] = tagAndValue;

  if (
    flagsText === undefined ||
    tag === undefined ||
    !/^[a-z\d-]{1,15}$/iu.test(tag)
  ) {
    return invalidRecord("InvalidRecordData");
  }

  const flags = parseUnsignedInteger(flagsText, 255);

  const afterFlags = trimmedData.slice(flagsText.length).trimStart();
  const valueText = afterFlags.slice(tag.length).trimStart();
  const quoted = valueText.startsWith('"') && valueText.endsWith('"');

  if (flags === null || (valueText.startsWith('"') && !quoted)) {
    return invalidRecord("InvalidRecordData");
  }

  const unquotedValue = quoted ? valueText.slice(1, -1) : valueText;

  const value = unquotedValue.replaceAll(
    CAA_ESCAPED_CHARACTER,
    (_match, escaped: string) => escaped
  );

  return ok({ type: "CAA", flags, tag: tag.toLowerCase(), value });
};

/**
 * Parse and normalize the RDATA text for a supported DNS resource record.
 *
 * @param type - DNS record type, case-insensitive.
 * @param data - The resolver's presentation-form record data.
 * @returns Typed normalized record data or a structured parsing failure.
 */
export const parseDnsRecordData = (
  type: string,
  data: string
): Result<DnsRecordData, DnsRecordError> => {
  switch (type.toUpperCase()) {
    case "A": {
      return parseAddressData("A", data);
    }

    case "AAAA": {
      return parseAddressData("AAAA", data);
    }

    case "CAA": {
      return parseCaaData(data);
    }

    case "CNAME": {
      return parseTargetData("CNAME", data);
    }

    case "NS": {
      return parseTargetData("NS", data);
    }

    case "PTR": {
      return parseTargetData("PTR", data);
    }

    case "MX": {
      return parseMxData(data);
    }

    case "SOA": {
      return parseSoaData(data);
    }

    case "SRV": {
      return parseSrvData(data);
    }

    case "TXT": {
      return ok({ type: "TXT", text: data });
    }

    default: {
      return invalidRecord("InvalidRecordType");
    }
  }
};

/**
 * Parse a DNS TTL in seconds, including zero, within the unsigned 32-bit range.
 *
 * @param input - Resolver-provided TTL seconds.
 * @returns The parsed TTL or an invalid-TTL failure.
 */
export const parseDnsTtl = (input: number): Result<number, DnsRecordError> =>
  Number.isSafeInteger(input) && input >= 0 && input <= UINT32_MAX
    ? ok(input)
    : invalidRecord("InvalidTtl");
