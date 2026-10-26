import {
  ApiErrorCodeSchema,
  ApiErrorResponseSchema,
  ApiHealthResponseSchema,
  ApiMeResponseSchema,
  DnsLookupResponseSchema,
  PublicAsnLookupResponseSchema,
  PublicBgpPrefixLookupResponseSchema,
  PublicNetworkLookupResponseSchema,
  RdapNormalizedRecordSchema,
} from "@netscry/schemas";
import type {
  ApiHealthResponse,
  ApiMeResponse,
  DnsLookupResponse,
  DnsRecordType,
  PublicAsnLookupResponse,
  PublicBgpPrefixLookupResponse,
  PublicNetworkLookupResponse,
  RdapNormalizedRecord,
} from "@netscry/schemas";
import { Effect, Schema } from "effect";

/** A stable SDK failure with safe API context and no raw response body. */
// oxlint-disable-next-line unicorn/throw-new-error -- This is the documented Effect Schema tagged-error class pattern.
export class NetScrySdkError extends Schema.TaggedError<NetScrySdkError>()(
  "NetScrySdkError",
  {
    reason: Schema.Literals([
      "configuration",
      "network",
      "http",
      "invalid-json",
      "invalid-response",
    ]),
    message: Schema.NonEmptyString,
    status: Schema.optionalKey(Schema.Int),
    code: Schema.optionalKey(ApiErrorCodeSchema),
  }
) {}

/** Options for constructing a client for a deployed NetScry API. */
export interface NetScryClientOptions {
  /** Absolute HTTP(S) origin or base URL for the NetScry API. */
  readonly baseUrl: string;

  /** Fetch implementation used for all API requests. Defaults to global fetch. */
  readonly fetch?: NetScryFetch;
}

/** Minimal standard Fetch signature accepted by the client. */
export type NetScryFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Typed Effects for the versioned NetScry HTTP API. */
export interface NetScryClient {
  /** Read the API health response. */
  readonly health: () => Effect.Effect<ApiHealthResponse, NetScrySdkError>;

  /** Read metadata observed for the current request. */
  readonly me: () => Effect.Effect<ApiMeResponse, NetScrySdkError>;

  /** Look up local IP-purpose and CIDR facts for an address or range. */
  readonly lookupNetwork: (
    addressOrCidr: string
  ) => Effect.Effect<PublicNetworkLookupResponse, NetScrySdkError>;

  /** Look up registration and announced prefixes for an ASN. */
  readonly lookupAsn: (
    asn: string
  ) => Effect.Effect<PublicAsnLookupResponse, NetScrySdkError>;

  /** Look up RouteViews observations for a network prefix. */
  readonly lookupBgp: (
    prefix: string
  ) => Effect.Effect<PublicBgpPrefixLookupResponse, NetScrySdkError>;

  /** Resolve DNS records for a name or reverse-lookup address. */
  readonly lookupDns: (
    query: string,
    recordType?: DnsRecordType
  ) => Effect.Effect<DnsLookupResponse, NetScrySdkError>;

  /** Look up public RDAP registration data for an IP address or range. */
  readonly lookupRdapIp: (
    addressOrCidr: string
  ) => Effect.Effect<RdapNormalizedRecord, NetScrySdkError>;

  /** Look up public RDAP registration data for a domain name. */
  readonly lookupRdapDomain: (
    domain: string
  ) => Effect.Effect<RdapNormalizedRecord, NetScrySdkError>;

  /** Look up public registration data for a domain using the general domain route. */
  readonly lookupDomain: (
    domain: string
  ) => Effect.Effect<RdapNormalizedRecord, NetScrySdkError>;
}

const makeConfigurationError = () =>
  new NetScrySdkError({
    reason: "configuration",
    message: "The NetScry base URL must be an absolute HTTP or HTTPS URL.",
  });

const toUrl = (
  baseUrl: string,
  path: string
): Effect.Effect<URL, NetScrySdkError> =>
  Effect.gen(function* parseApiUrl() {
    const url = yield* Effect.try({
      try: () => new URL(path, baseUrl),
      catch: makeConfigurationError,
    });

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return yield* Effect.fail(makeConfigurationError());
    }

    return url;
  });

const createRequest =
  (baseUrl: string, fetcher: NetScryFetch) =>
  <Value>(path: string, schema: Schema.Decoder<Value>) =>
    Effect.gen(function* request() {
      const url = yield* toUrl(baseUrl, path);

      const response = yield* Effect.tryPromise({
        try: async (signal) =>
          await fetcher(url, {
            headers: { accept: "application/json" },
            signal,
          }),
        catch: () =>
          new NetScrySdkError({
            reason: "network",
            message: "The NetScry API could not be reached.",
          }),
      });

      const body: unknown = yield* Effect.tryPromise({
        try: async () => await response.json(),
        catch: () =>
          new NetScrySdkError({
            reason: response.ok ? "invalid-json" : "http",
            message: response.ok
              ? "The NetScry API returned unreadable JSON."
              : "The NetScry API request failed.",
            status: response.status,
          }),
      });

      if (!response.ok) {
        const apiError = Schema.decodeUnknownResult(ApiErrorResponseSchema)(
          body
        );

        const apiErrorValue =
          apiError._tag === "Success" ? apiError.success.error : undefined;

        const message =
          apiErrorValue?.message ?? "The NetScry API request failed.";

        const error =
          apiErrorValue === undefined
            ? new NetScrySdkError({
                reason: "http",
                message,
                status: response.status,
              })
            : new NetScrySdkError({
                reason: "http",
                message,
                status: response.status,
                code: apiErrorValue.code,
              });

        return yield* Effect.fail(error);
      }

      return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
        Effect.mapError(
          () =>
            new NetScrySdkError({
              reason: "invalid-response",
              message: "The NetScry API response did not match its contract.",
              status: response.status,
            })
        )
      );
    });

/** Create an injectable client for NetScry's schema-validated v1 API.
 * @param options - API base URL and optional Fetch implementation.
 * @returns Endpoint methods whose results and expected failures are Effects.
 */
export const createNetScryClient = (
  options: NetScryClientOptions
): NetScryClient => {
  const fetcher = options.fetch ?? globalThis.fetch;
  const request = createRequest(options.baseUrl, fetcher);

  return {
    health: () => request("/api/v1/health", ApiHealthResponseSchema),
    me: () => request("/api/v1/me", ApiMeResponseSchema),
    lookupNetwork: (addressOrCidr) =>
      request(
        `/api/v1/ip/${encodeURIComponent(addressOrCidr)}`,
        PublicNetworkLookupResponseSchema
      ),
    lookupAsn: (asn) =>
      request(
        `/api/v1/asn/${encodeURIComponent(asn)}`,
        PublicAsnLookupResponseSchema
      ),
    lookupBgp: (prefix) => {
      const search = new URLSearchParams({ prefix });

      return request(
        `/api/v1/bgp?${search.toString()}`,
        PublicBgpPrefixLookupResponseSchema
      );
    },
    lookupDns: (query, recordType) => {
      const search = new URLSearchParams();

      if (recordType !== undefined) {
        search.set("type", recordType);
      }

      const suffix = search.size === 0 ? "" : `?${search.toString()}`;

      return request(
        `/api/v1/dns/${encodeURIComponent(query)}${suffix}`,
        DnsLookupResponseSchema
      );
    },
    lookupRdapIp: (addressOrCidr) =>
      request(
        `/api/v1/rdap/ip/${encodeURIComponent(addressOrCidr)}`,
        RdapNormalizedRecordSchema
      ),
    lookupRdapDomain: (domain) =>
      request(
        `/api/v1/rdap/domain/${encodeURIComponent(domain)}`,
        RdapNormalizedRecordSchema
      ),
    lookupDomain: (domain) =>
      request(
        `/api/v1/domain/${encodeURIComponent(domain)}`,
        RdapNormalizedRecordSchema
      ),
  };
};
