import { parseAsn, parseCidr, parseIpAddress } from "@netscry/core";
import {
  AsnAnnouncedPrefixSchema,
  ExternalProviderError,
  PublicAsnLookupResponseSchema,
  PublicBgpPrefixLookupResponseSchema,
} from "@netscry/schemas";
import type {
  AsnAnnouncedPrefix,
  PublicAsnLookupResponse,
  PublicBgpPrefixLookupResponse,
  RdapNormalizedRecord,
} from "@netscry/schemas";
import { Context, Effect, Layer, Result, Schema } from "effect";

import {
  ExternalProviderHttpClient,
  layerLive as externalProviderLayerLive,
} from "./external-provider-http.ts";
import { RdapService, layerLive as rdapLayerLive } from "./rdap.ts";
import type { RdapServiceContract } from "./rdap.ts";

/** Public RouteViews API root used for current routing observations. */
export const ROUTEVIEWS_API_URL = "https://api.routeviews.org/";

const ROUTEVIEWS_ORIGIN = new URL(ROUTEVIEWS_API_URL).origin;

const ROUTEVIEWS_COVERAGE =
  "Observed by a subset of RouteViews collectors; this is not a complete global routing view.";

const ROUTEVIEWS_PROVIDER = "routeviews";
const INVALID_REQUEST = "invalid-request" as const;
const INVALID_RESPONSE = "invalid-response" as const;
const NORMALIZE_PREFIX_ROUTES_OPERATION = "normalize-prefix-routes";

const RouteViewsPrefixSchema = Schema.Struct({
  prefix: Schema.NonEmptyString,
  origin_asn: Schema.Int,
  rpki_state: Schema.optionalKey(
    Schema.Literals(["valid", "invalid", "not-found"])
  ),
  reporting_peers: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        peer_asn: Schema.Int,
        peer_addr: Schema.NonEmptyString,
        collector: Schema.NonEmptyString,
        as_path: Schema.NonEmptyString,
        communities: Schema.String,
        timestamp: Schema.NonEmptyString,
      })
    )
  ),
});

const RouteViewsAsnPrefixesSchema = Schema.Array(Schema.String).check(
  Schema.makeFilter(
    (prefixes) =>
      prefixes.length <= 100_000 || "RouteViews returned too many prefixes"
  )
);

const RouteViewsPrefixRoutesSchema = Schema.Array(RouteViewsPrefixSchema).check(
  Schema.makeFilter(
    (routes) =>
      routes.length <= 10_000 ||
      "RouteViews returned too many route observations"
  )
);

type RouteViewsPrefix = typeof RouteViewsPrefixSchema.Type;

/** Fixed RouteViews request passed to the bounded provider transport. */
export interface RouteViewsJsonRequest {
  readonly url: string;
}

/** Injectable, schema-validating RouteViews transport. */
export type RouteViewsJsonFetcher = <S extends Schema.Constraint>(
  request: RouteViewsJsonRequest,
  schema: S
) => Effect.Effect<S["Type"], ExternalProviderError, S["DecodingServices"]>;

/** Public ASN registration and observed BGP lookup operations. */
export interface AsnBgpServiceContract {
  /** Look up the RDAP holder and RouteViews announced prefixes for an ASN. */
  readonly lookupAsn: (
    input: string
  ) => Effect.Effect<PublicAsnLookupResponse, ExternalProviderError>;

  /** Look up RouteViews origin and peer observations for an IP or prefix. */
  readonly lookupPrefix: (
    input: string
  ) => Effect.Effect<PublicBgpPrefixLookupResponse, ExternalProviderError>;
}

/** Effect service for replaceable ASN registration and BGP enrichment. */
export class AsnBgpService extends Context.Service<
  AsnBgpService,
  AsnBgpServiceContract
>()("@netscry/web/AsnBgpService") {}

const providerError = (
  operation: string,
  reason: ExternalProviderError["reason"]
) =>
  new ExternalProviderError({
    provider: ROUTEVIEWS_PROVIDER,
    operation,
    reason,
    retryable: false,
  });

const parsePrefix = (
  input: string
): AsnAnnouncedPrefix | ExternalProviderError => {
  const candidate = input.trim();

  let withPrefixLength = candidate;

  if (!candidate.includes("/")) {
    const address = parseIpAddress(candidate);

    if (address._tag === "Err") {
      return providerError("validate-prefix", INVALID_REQUEST);
    }

    const prefixLength = address.value.version === 4 ? 32 : 128;
    withPrefixLength = `${address.value.canonical}/${prefixLength}`;
  }

  const parsed = parseCidr(withPrefixLength);

  if (parsed._tag === "Err") {
    return providerError("validate-prefix", INVALID_REQUEST);
  }

  return {
    prefix: parsed.value.canonical,
    version: parsed.value.version,
  };
};

const toAnnouncedPrefix = (
  prefix: string
): AsnAnnouncedPrefix | ExternalProviderError => {
  const parsed = parseCidr(prefix);

  if (parsed._tag === "Err") {
    return providerError("normalize-announced-prefixes", INVALID_RESPONSE);
  }

  const normalized = {
    prefix: parsed.value.canonical,
    version: parsed.value.version,
  };

  const decoded = Schema.decodeUnknownResult(AsnAnnouncedPrefixSchema)(
    normalized
  );

  return decoded._tag === "Success"
    ? decoded.success
    : providerError("normalize-announced-prefixes", INVALID_RESPONSE);
};

const asnQueryUrl = (asn: number) =>
  new URL(`asn/${asn}`, ROUTEVIEWS_API_URL).href;

const prefixQueryUrl = (prefix: AsnAnnouncedPrefix) =>
  new URL(`prefix/${prefix.prefix}`, ROUTEVIEWS_API_URL).href;

const toRouteViewsRoute = (
  route: RouteViewsPrefix
): PublicBgpPrefixLookupResponse["routes"][number] | ExternalProviderError => {
  const prefix = toAnnouncedPrefix(route.prefix);
  const origin = parseAsn(String(route.origin_asn));

  if (prefix instanceof ExternalProviderError || origin._tag === "Err") {
    return providerError(NORMALIZE_PREFIX_ROUTES_OPERATION, INVALID_RESPONSE);
  }

  const reportingPeers = [];

  for (const peer of route.reporting_peers ?? []) {
    const peerAsn = parseAsn(String(peer.peer_asn));
    const peerAddress = parseIpAddress(peer.peer_addr);

    if (peerAsn._tag === "Err" || peerAddress._tag === "Err") {
      return providerError(NORMALIZE_PREFIX_ROUTES_OPERATION, INVALID_RESPONSE);
    }

    reportingPeers.push({
      peerAsn: peerAsn.value.value,
      peerAddress: {
        address: peerAddress.value.canonical,
        version: peerAddress.value.version,
      },
      collector: peer.collector,
      asPath: peer.as_path,
      communities: peer.communities
        .trim()
        .split(/\s+/u)
        .filter((community) => community.length > 0),
      observedAt: peer.timestamp,
    });
  }

  const normalized = {
    prefix,
    originAsn: origin.value.value,
    reportingPeers,
  };

  if (route.rpki_state !== undefined) {
    Object.assign(normalized, { rpkiState: route.rpki_state });
  }

  const decoded = Schema.decodeUnknownResult(
    PublicBgpPrefixLookupResponseSchema.fields.routes
  )([normalized]);

  return decoded._tag === "Success"
    ? (decoded.success[0] ??
        providerError(NORMALIZE_PREFIX_ROUTES_OPERATION, INVALID_RESPONSE))
    : providerError(NORMALIZE_PREFIX_ROUTES_OPERATION, INVALID_RESPONSE);
};

const unavailableField = (reason: "provider-failure" | "not-provided") => ({
  _tag: "Unavailable" as const,
  source: "third-party" as const,
  reason,
  sensitivity: "public" as const,
});

const availableField = <Value>(value: Value) => ({
  _tag: "Available" as const,
  source: "third-party" as const,
  sensitivity: "public" as const,
  value,
});

const holderField = (
  rdapResult: Result.Result<RdapNormalizedRecord, ExternalProviderError>
) => {
  if (Result.isFailure(rdapResult)) {
    return unavailableField("provider-failure");
  }

  const { success: record } = rdapResult;
  const { name } = record.data;

  return name === undefined
    ? unavailableField("not-provided")
    : availableField(name);
};

const makeService = (
  fetchJson: RouteViewsJsonFetcher,
  rdap: Pick<RdapServiceContract, "lookup">
): AsnBgpServiceContract => ({
  lookupAsn: (input) => {
    const parsed = parseAsn(input);

    if (parsed._tag === "Err") {
      return Effect.fail(providerError("validate-asn", INVALID_REQUEST));
    }

    const queryUrl = asnQueryUrl(parsed.value.value);

    const rdapLookup = Effect.result(
      rdap.lookup({ kind: "asn", asn: parsed.value.canonical })
    );

    const routesLookup = Effect.result(
      fetchJson({ url: queryUrl }, RouteViewsAsnPrefixesSchema)
    );

    return Effect.all([rdapLookup, routesLookup], { concurrency: 2 }).pipe(
      Effect.flatMap(([rdapResult, routesResult]) => {
        const holder = holderField(rdapResult);

        let announcedPrefixes:
          | ReturnType<typeof unavailableField>
          | {
              readonly _tag: "Available";
              readonly source: "third-party";
              readonly sensitivity: "public";
              readonly value: readonly AsnAnnouncedPrefix[];
            };

        const routeViewsAttribution = {
          provider: "RouteViews" as const,
          queryUrl,
          coverage: ROUTEVIEWS_COVERAGE,
        };

        const attribution = Result.isSuccess(rdapResult)
          ? {
              routeViews: routeViewsAttribution,
              rdapQueryUrl: rdapResult.success.attribution.queryUrl,
            }
          : { routeViews: routeViewsAttribution };

        if (Result.isFailure(routesResult)) {
          announcedPrefixes = unavailableField("provider-failure");
        } else {
          const prefixes: AsnAnnouncedPrefix[] = [];

          for (const prefix of routesResult.success) {
            const normalized = toAnnouncedPrefix(prefix);

            if (normalized instanceof ExternalProviderError) {
              return Effect.fail(normalized);
            }

            prefixes.push(normalized);
          }

          announcedPrefixes = availableField(prefixes);
        }

        const result = Schema.decodeUnknownResult(
          PublicAsnLookupResponseSchema
        )({
          kind: "asn",
          asn: parsed.value.value,
          holder,
          announcedPrefixes,
          attribution,
        });

        return result._tag === "Success"
          ? Effect.succeed(result.success)
          : Effect.fail(providerError("normalize-asn", INVALID_RESPONSE));
      })
    );
  },

  lookupPrefix: (input) => {
    const prefix = parsePrefix(input);

    if (prefix instanceof ExternalProviderError) {
      return Effect.fail(prefix);
    }

    const queryUrl = prefixQueryUrl(prefix);

    return fetchJson({ url: queryUrl }, RouteViewsPrefixRoutesSchema).pipe(
      Effect.flatMap((routes) => {
        const normalizedRoutes = [];

        for (const route of routes) {
          const normalized = toRouteViewsRoute(route);

          if (normalized instanceof ExternalProviderError) {
            return Effect.fail(normalized);
          }

          normalizedRoutes.push(normalized);
        }

        const result = Schema.decodeUnknownResult(
          PublicBgpPrefixLookupResponseSchema
        )({
          kind: "bgp-prefix",
          query: prefix,
          routes: normalizedRoutes,
          attribution: {
            provider: "RouteViews",
            queryUrl,
            coverage: ROUTEVIEWS_COVERAGE,
          },
        });

        return result._tag === "Success"
          ? Effect.succeed(result.success)
          : Effect.fail(
              providerError(NORMALIZE_PREFIX_ROUTES_OPERATION, INVALID_RESPONSE)
            );
      })
    );
  },
});

/** Create a testable ASN/BGP service using injected routing and RDAP services.
 * @param fetchJson - Fixed-origin transport for RouteViews responses.
 * @param rdapLayer - Replaceable RDAP registration source.
 * @returns A service layer for ASN and prefix-origin lookups.
 */
export const layer = (
  fetchJson: RouteViewsJsonFetcher,
  rdapLayer: Layer.Layer<RdapService>
) =>
  Layer.effect(
    AsnBgpService,
    Effect.gen(function* createService() {
      return makeService(fetchJson, yield* RdapService);
    })
  ).pipe(Layer.provide(rdapLayer));

const fetchRouteViewsJson: RouteViewsJsonFetcher = (request, schema) =>
  Effect.gen(function* fetchFromRouteViews() {
    const client = yield* ExternalProviderHttpClient;

    return yield* client.getJson(
      {
        provider: ROUTEVIEWS_PROVIDER,
        operation: "routing-lookup",
        url: request.url,
      },
      schema
    );
  }).pipe(
    Effect.provide(
      externalProviderLayerLive({ [ROUTEVIEWS_PROVIDER]: ROUTEVIEWS_ORIGIN })
    )
  );

/** Live RouteViews lookups with IANA-bootstrap RDAP registration data. */
export const layerLive = layer(fetchRouteViewsJson, rdapLayerLive);
