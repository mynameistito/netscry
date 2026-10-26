import {
  normalizeDomain,
  ok,
  parseDnsRecordData,
  parseDnsTtl,
  parseIpAddress,
} from "@netscry/core";
import {
  DnsLookupResponseSchema,
  DnsRecordTypeSchema,
  DnsResourceRecordSchema,
  ExternalProviderError,
} from "@netscry/schemas";
import type {
  DnsLookupResponse,
  DnsRecordType,
  DnsResourceRecord,
} from "@netscry/schemas";
import { Cache, Context, Duration, Effect, Exit, Layer, Schema } from "effect";

import {
  ExternalProviderHttpClient,
  layerLive as externalProviderLayerLive,
} from "./external-provider-http.ts";

/** Public Cloudflare 1.1.1.1 DNS-over-HTTPS JSON endpoint. */
export const CLOUDFLARE_DNS_JSON_URL = "https://cloudflare-dns.com/dns-query";

const CLOUDFLARE_DNS_ORIGIN = new URL(CLOUDFLARE_DNS_JSON_URL).origin;
const DNS_CACHE_CAPACITY = 512;
const INVALID_REQUEST = "invalid-request" as const;
const INVALID_RESPONSE = "invalid-response" as const;
const NORMALIZE_RESPONSE_OPERATION = "normalize-response";
const DNS_STATUS_NOERROR = 0;
const DNS_STATUS_NXDOMAIN = 3;

type DnsCache = Cache.Cache<string, DnsLookupResponse, ExternalProviderError>;

// Cache handles survive per-request service Layers within this Worker isolate.
const cachesByFetcher = new WeakMap<DnsJsonFetcher, DnsCache>();

const DnsJsonRecordSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.Int,
  TTL: Schema.Int,
  data: Schema.String,
});

const DnsJsonResponseSchema = Schema.Struct({
  Status: Schema.Int,
  TC: Schema.optionalKey(Schema.Boolean),
  AD: Schema.optionalKey(Schema.Boolean),
  Answer: Schema.optionalKey(Schema.Array(DnsJsonRecordSchema)),
  Authority: Schema.optionalKey(Schema.Array(DnsJsonRecordSchema)),
});

const RECORD_TYPE_CODES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  CAA: 257,
} as const satisfies Record<DnsRecordType, number>;

const recordTypeFromCode = (code: number): DnsRecordType | undefined => {
  switch (code) {
    case 1: {
      return "A";
    }

    case 2: {
      return "NS";
    }

    case 5: {
      return "CNAME";
    }

    case 6: {
      return "SOA";
    }

    case 12: {
      return "PTR";
    }

    case 15: {
      return "MX";
    }

    case 16: {
      return "TXT";
    }

    case 28: {
      return "AAAA";
    }

    case 33: {
      return "SRV";
    }

    case 257: {
      return "CAA";
    }

    default: {
      return undefined;
    }
  }
};

/** Fixed resolver request passed to the bounded JSON transport. */
export interface DnsJsonRequest {
  readonly url: string;
}

/** Injectable bounded DNS JSON transport used by the DNS service. */
export type DnsJsonFetcher = <S extends Schema.Constraint>(
  request: DnsJsonRequest,
  schema: S
) => Effect.Effect<S["Type"], ExternalProviderError, S["DecodingServices"]>;

/** Public DNS lookup service contract. */
export interface DnsServiceContract {
  readonly lookup: (
    query: string,
    recordType: DnsRecordType
  ) => Effect.Effect<DnsLookupResponse, ExternalProviderError>;
}

/** Effect service for normalized DNS-over-HTTPS answers. */
export class DnsService extends Context.Service<
  DnsService,
  DnsServiceContract
>()("@netscry/web/DnsService") {}

interface NormalizedQuery {
  readonly name: string;
  readonly recordType: DnsRecordType;
}

const providerError = (
  operation: string,
  reason: ExternalProviderError["reason"]
) =>
  new ExternalProviderError({
    provider: "cloudflare-doh",
    operation,
    reason,
    retryable: false,
  });

const reverseIpName = (address: string): string | undefined => {
  const parsed = parseIpAddress(address);

  if (parsed._tag === "Err") {
    return undefined;
  }

  if (parsed.value.version === 4) {
    return `${[...parsed.value.bytes].toReversed().join(".")}.in-addr.arpa`;
  }

  const nibbles = [...parsed.value.bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .split("")
    .toReversed();

  return `${nibbles.join(".")}.ip6.arpa`;
};

const normalizeQuery = (
  query: string,
  recordType: DnsRecordType
): NormalizedQuery | ExternalProviderError => {
  const parsedAddress = parseIpAddress(query.trim());

  if (recordType === "PTR" && parsedAddress._tag === "Ok") {
    const name = reverseIpName(parsedAddress.value.canonical);

    return name === undefined
      ? providerError("validate-query", INVALID_REQUEST)
      : { name, recordType };
  }

  const domain = normalizeDomain(query);

  return domain._tag === "Ok"
    ? { name: domain.value, recordType }
    : providerError("validate-query", INVALID_REQUEST);
};

const makeResolverUrl = (name: string, recordType: DnsRecordType) => {
  const url = new URL(CLOUDFLARE_DNS_JSON_URL);
  url.searchParams.set("name", name);
  url.searchParams.set("type", recordType);

  return url.href;
};

const normalizeOwnerName = (name: string) =>
  name === "." ? ok(".") : normalizeDomain(name);

const normalizeRecord = (
  record: typeof DnsJsonRecordSchema.Type
): DnsResourceRecord | undefined | ExternalProviderError => {
  const recordType = recordTypeFromCode(record.type);

  if (recordType === undefined) {
    return undefined;
  }

  const ownerName = normalizeOwnerName(record.name);
  const ttl = parseDnsTtl(record.TTL);
  const data = parseDnsRecordData(recordType, record.data);

  if (ownerName._tag === "Err" || ttl._tag === "Err" || data._tag === "Err") {
    return providerError(NORMALIZE_RESPONSE_OPERATION, INVALID_RESPONSE);
  }

  const normalizedData =
    data.value.type === "A" || data.value.type === "AAAA"
      ? {
          type: data.value.type,
          address: {
            version: data.value.address.version,
            canonical: data.value.address.canonical,
          },
        }
      : data.value;

  try {
    return Schema.decodeUnknownSync(DnsResourceRecordSchema)({
      name: ownerName.value,
      type: recordType,
      ttl: ttl.value,
      data: normalizedData,
    });
  } catch {
    return providerError(NORMALIZE_RESPONSE_OPERATION, INVALID_RESPONSE);
  }
};

const negativeCacheTtl = (
  authority: readonly (typeof DnsJsonRecordSchema.Type)[]
): number | undefined => {
  let ttl: number | undefined;

  for (const record of authority) {
    if (record.type !== RECORD_TYPE_CODES.SOA) {
      continue;
    }

    const soa = parseDnsRecordData("SOA", record.data);
    const recordTtl = parseDnsTtl(record.TTL);

    if (
      soa._tag === "Ok" &&
      soa.value.type === "SOA" &&
      recordTtl._tag === "Ok"
    ) {
      const negativeTtl = Math.min(recordTtl.value, soa.value.minimum);
      ttl = ttl === undefined ? negativeTtl : Math.min(ttl, negativeTtl);
    }
  }

  return ttl;
};

const normalizeResponse = (
  query: NormalizedQuery,
  response: typeof DnsJsonResponseSchema.Type
): DnsLookupResponse | ExternalProviderError => {
  const records: DnsResourceRecord[] = [];

  for (const answer of response.Answer ?? []) {
    const record = normalizeRecord(answer);

    if (record instanceof ExternalProviderError) {
      return record;
    }

    if (record !== undefined) {
      records.push(record);
    }
  }

  let cacheTtlSeconds: number | undefined;

  const answerTtl =
    records.length > 0
      ? Math.min(...records.map((record) => record.ttl))
      : undefined;

  const hasRequestedType = records.some(
    (record) => record.type === query.recordType
  );

  if (response.Status === DNS_STATUS_NOERROR && hasRequestedType) {
    cacheTtlSeconds = answerTtl;
  } else if (
    response.Status === DNS_STATUS_NOERROR ||
    response.Status === DNS_STATUS_NXDOMAIN
  ) {
    const negativeTtl = negativeCacheTtl(response.Authority ?? []);

    if (negativeTtl !== undefined) {
      cacheTtlSeconds =
        answerTtl === undefined
          ? negativeTtl
          : Math.min(answerTtl, negativeTtl);
    }
  }

  const output: DnsLookupResponse = {
    query: query.name,
    recordType: query.recordType,
    status: response.Status,
    truncated: response.TC ?? false,
    records,
    attribution: {
      resolver: "Cloudflare 1.1.1.1",
      resolverUrl: CLOUDFLARE_DNS_JSON_URL,
    },
  };

  if (response.AD !== undefined) {
    Object.assign(output, { dnssecAuthenticated: response.AD });
  }

  if (cacheTtlSeconds !== undefined) {
    Object.assign(output, { cacheTtlSeconds });
  }

  const decoded = Schema.decodeUnknownResult(DnsLookupResponseSchema)(output);

  return decoded._tag === "Success"
    ? decoded.success
    : providerError(NORMALIZE_RESPONSE_OPERATION, INVALID_RESPONSE);
};

const cacheKey = (query: NormalizedQuery) =>
  `${query.recordType}\n${query.name}`;

const parseCacheKey = (
  key: string
): NormalizedQuery | ExternalProviderError => {
  const separator = key.indexOf("\n");

  if (separator < 1) {
    return providerError("decode-cache-key", INVALID_REQUEST);
  }

  const recordType = Schema.decodeUnknownResult(DnsRecordTypeSchema)(
    key.slice(0, separator)
  );

  const name = key.slice(separator + 1);

  if (recordType._tag === "Failure" || name.length === 0) {
    return providerError("decode-cache-key", INVALID_REQUEST);
  }

  return { name, recordType: recordType.success };
};

const lookupUncached = (fetchJson: DnsJsonFetcher, query: NormalizedQuery) =>
  fetchJson(
    { url: makeResolverUrl(query.name, query.recordType) },
    DnsJsonResponseSchema
  ).pipe(
    Effect.flatMap((response) => {
      const normalized = normalizeResponse(query, response);

      return normalized instanceof ExternalProviderError
        ? Effect.fail(normalized)
        : Effect.succeed(normalized);
    })
  );

const makeDnsService = (fetchJson: DnsJsonFetcher) =>
  Layer.effect(
    DnsService,
    Effect.gen(function* createDnsService() {
      let cache = cachesByFetcher.get(fetchJson);

      if (cache === undefined) {
        cache = yield* Cache.makeWith<
          string,
          DnsLookupResponse,
          ExternalProviderError
        >(
          (key) => {
            const query = parseCacheKey(key);

            return query instanceof ExternalProviderError
              ? Effect.fail(query)
              : lookupUncached(fetchJson, query);
          },
          {
            capacity: DNS_CACHE_CAPACITY,
            timeToLive: (exit) =>
              Exit.isSuccess(exit) && exit.value.cacheTtlSeconds !== undefined
                ? Duration.seconds(exit.value.cacheTtlSeconds)
                : Duration.zero,
          }
        );
        cachesByFetcher.set(fetchJson, cache);
      }

      return DnsService.of({
        lookup: (input, recordType) => {
          const query = normalizeQuery(input, recordType);

          return query instanceof ExternalProviderError
            ? Effect.fail(query)
            : Cache.get(cache, cacheKey(query));
        },
      });
    })
  );

/** Create a DNS service with TTL-aware caching and a bounded JSON transport.
 * @param fetchJson - Requester that enforces resolver origin and response limits.
 * @returns A service Layer that caches answers until their DNS TTL expires.
 */
export const layer = (fetchJson: DnsJsonFetcher) => makeDnsService(fetchJson);

const fetchWithExternalProvider: DnsJsonFetcher = (request, schema) =>
  Effect.gen(function* fetchFromResolver() {
    const client = yield* ExternalProviderHttpClient;

    return yield* client.getJson(
      {
        provider: "cloudflare-doh",
        operation: "dns-lookup",
        url: request.url,
        accept: "application/dns-json",
      },
      schema
    );
  }).pipe(
    Effect.provide(
      externalProviderLayerLive({ "cloudflare-doh": CLOUDFLARE_DNS_ORIGIN })
    )
  );

/** Production service using Cloudflare's documented DNS-over-HTTPS JSON endpoint. */
export const layerLive = makeDnsService(fetchWithExternalProvider);
