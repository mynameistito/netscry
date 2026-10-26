import {
  ExternalProviderError,
  RdapBootstrapRegistrySchema,
  RdapNormalizedRecordSchema,
  RdapRawRecordSchema,
} from "@netscry/schemas";
import type {
  RdapBootstrapRegistry,
  RdapEntityContact,
  RdapNormalizedRecord,
  RdapRawRecord,
  RdapRecordData,
} from "@netscry/schemas";
import { Context, Effect, Layer, Schema } from "effect";

import {
  ExternalProviderHttpClient,
  layerLive as externalProviderLayerLive,
} from "./external-provider-http.ts";
import {
  buildRdapQueryUrl,
  discoverRdapService,
  parseRdapLookupTarget,
} from "./rdap-bootstrap.ts";
import type { RdapLookupTarget } from "./rdap-bootstrap.ts";

const IANA_ORIGIN = "https://data.iana.org";

const REGISTRY_URLS = {
  ipv4: `${IANA_ORIGIN}/rdap/ipv4.json`,
  ipv6: `${IANA_ORIGIN}/rdap/ipv6.json`,
  asn: `${IANA_ORIGIN}/rdap/asn.json`,
  domain: `${IANA_ORIGIN}/rdap/dns.json`,
} as const;

type RegistryKind = keyof typeof REGISTRY_URLS;

const REGISTRY_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedRegistry {
  readonly registry: RdapBootstrapRegistry;
  readonly expiresAt: number;
}

// This isolate-wide cache contains public IANA documents, never request data.
const registryCaches = new WeakMap<
  RdapJsonFetcher,
  Map<RegistryKind, CachedRegistry>
>();

type JsonValue = Schema.Json | undefined;

type Mutable<Value> = { -readonly [Key in keyof Value]: Value[Key] };

const INVALID_RESPONSE = "invalid-response" as const;

/** Fixed-origin request information passed to the bounded JSON transport. */
export interface RdapJsonRequest {
  readonly provider: string;
  readonly operation: string;
  readonly origin: string;
  readonly url: string;
}

/** Injectable bounded JSON transport used by the RDAP service. */
export type RdapJsonFetcher = <S extends Schema.Constraint>(
  request: RdapJsonRequest,
  schema: S
) => Effect.Effect<S["Type"], ExternalProviderError, S["DecodingServices"]>;

/** Public RDAP lookup service contract. */
export interface RdapServiceContract {
  readonly lookup: (
    target: RdapLookupTarget
  ) => Effect.Effect<RdapNormalizedRecord, ExternalProviderError>;
}

/** Effect service for bounded, normalized RDAP lookups. */
export class RdapService extends Context.Service<
  RdapService,
  RdapServiceContract
>()("@netscry/web/RdapService") {}

const providerError = (
  operation: string,
  reason: ExternalProviderError["reason"]
) =>
  new ExternalProviderError({
    provider: "iana-rdap",
    operation,
    reason,
    retryable: false,
  });

type VcardProperty = "fn" | "org" | "email" | "tel";

type VcardFields = Partial<Record<VcardProperty, readonly string[]>>;

const decodeString = Schema.decodeUnknownResult(Schema.String);
const decodeNumber = Schema.decodeUnknownResult(Schema.Int);
const decodeJsonArray = Schema.decodeUnknownResult(Schema.Array(Schema.Json));
const decodeObject = Schema.decodeUnknownResult(RdapRawRecordSchema);

const nonEmptyString = (value: JsonValue): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const decoded = decodeString(value);

  if (decoded._tag !== "Success") {
    return undefined;
  }

  const normalized = decoded.success.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const objectValue = (value: JsonValue): RdapRawRecord | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const decoded = decodeObject(value);

  return decoded._tag === "Success" ? decoded.success : undefined;
};

const arrayValue = (value: JsonValue): readonly Schema.Json[] => {
  if (value === undefined) {
    return [];
  }

  const decoded = decodeJsonArray(value);

  return decoded._tag === "Success" ? decoded.success : [];
};

const strings = (value: JsonValue): string[] =>
  arrayValue(value).flatMap((item) => {
    const text = nonEmptyString(item);

    return text === undefined ? [] : [text];
  });

const textValues = (value: JsonValue): string[] => {
  const text = nonEmptyString(value);

  return text === undefined ? strings(value) : [text];
};

const readVcard = (value: JsonValue): VcardFields => {
  const card = arrayValue(value);
  const [, properties] = card;
  const fields: Partial<Record<VcardProperty, string[]>> = {};

  if (properties === undefined) {
    return fields;
  }

  for (const item of arrayValue(properties)) {
    const property = arrayValue(item);
    const rawName = property.at(0);
    const rawValue = property.at(3);
    const name = rawName === undefined ? undefined : nonEmptyString(rawName);

    if (name !== undefined && rawValue !== undefined) {
      const key = name.toLowerCase();

      if (key === "fn" || key === "org" || key === "email" || key === "tel") {
        const text = textValues(rawValue);

        if (text.length > 0) {
          fields[key] = [...(fields[key] ?? []), ...text];
        }
      }
    }
  }

  return fields;
};

const normalizeEntity = (entity: RdapRawRecord): RdapEntityContact => {
  const card = readVcard(entity.vcardArray);
  const handle = nonEmptyString(entity.handle);
  const name = card.fn?.[0];

  const { org, email, tel } = card;

  const result: Mutable<RdapEntityContact> = {
    roles: strings(entity.roles),
    organizations: org ?? [],
    emails: email ?? [],
    phones: tel ?? [],
  };

  if (handle !== undefined) {
    result.handle = handle;
  }

  if (name !== undefined) {
    result.name = name;
  }

  return result;
};

const normalizeEntities = (input: JsonValue): RdapRecordData["entities"] => {
  const results: RdapRecordData["entities"][number][] = [];

  const queue: { readonly entity: RdapRawRecord; readonly depth: number }[] =
    [];

  for (const value of arrayValue(input)) {
    const entity = objectValue(value);

    if (entity !== undefined) {
      queue.push({ entity, depth: 0 });
    }
  }

  while (queue.length > 0 && results.length < 100) {
    const current = queue.shift();

    if (current === undefined) {
      break;
    }

    const { entity, depth } = current;
    const normalized = normalizeEntity(entity);
    results.push(normalized);

    if (depth < 5) {
      for (const childValue of arrayValue(entity.entities)) {
        const child = objectValue(childValue);

        if (child !== undefined) {
          queue.push({ entity: child, depth: depth + 1 });
        }
      }
    }
  }

  return results;
};

const normalizeEvents = (value: JsonValue): RdapRecordData["events"] =>
  arrayValue(value)
    .slice(0, 100)
    .flatMap((event) => {
      const object = objectValue(event);

      if (object === undefined) {
        return [];
      }

      const action = nonEmptyString(object.eventAction);
      const date = nonEmptyString(object.eventDate);

      return action === undefined || date === undefined
        ? []
        : [{ action, date }];
    });

const normalizeNameservers = (value: JsonValue): string[] =>
  arrayValue(value).flatMap((nameserver) => {
    const object = objectValue(nameserver);

    const name =
      object === undefined ? undefined : nonEmptyString(object.ldhName);

    return name === undefined ? [] : [name.toLowerCase()];
  });

const normalizeData = (record: RdapRawRecord): RdapRecordData => {
  const ipVersion = nonEmptyString(record.ipVersion);
  const startAutnum = decodeNumber(record.startAutnum);
  const endAutnum = decodeNumber(record.endAutnum);

  const data: Mutable<RdapRecordData> = {
    statuses: strings(record.status),
    events: normalizeEvents(record.events),
    nameservers: normalizeNameservers(record.nameservers),
    entities: normalizeEntities(record.entities),
  };

  const handle = nonEmptyString(record.handle);
  const name = nonEmptyString(record.name);
  const type = nonEmptyString(record.type);
  const country = nonEmptyString(record.country);
  const startAddress = nonEmptyString(record.startAddress);
  const endAddress = nonEmptyString(record.endAddress);
  const ldhName = nonEmptyString(record.ldhName);
  const unicodeName = nonEmptyString(record.unicodeName);

  if (handle !== undefined) {
    data.handle = handle;
  }

  if (name !== undefined) {
    data.name = name;
  }

  if (type !== undefined) {
    data.type = type;
  }

  if (country !== undefined) {
    data.country = country;
  }

  if (ipVersion === "v4" || ipVersion === "v6") {
    data.ipVersion = ipVersion;
  }

  if (startAddress !== undefined) {
    data.startAddress = startAddress;
  }

  if (endAddress !== undefined) {
    data.endAddress = endAddress;
  }

  if (startAutnum._tag === "Success") {
    data.startAutnum = startAutnum.success;
  }

  if (endAutnum._tag === "Success") {
    data.endAutnum = endAutnum.success;
  }

  if (ldhName !== undefined) {
    data.ldhName = ldhName;
  }

  if (unicodeName !== undefined) {
    data.unicodeName = unicodeName;
  }

  return data;
};

const registryKind = (
  target: ReturnType<typeof parseRdapLookupTarget>
): RegistryKind | undefined => {
  if (target._tag === "Err") {
    return undefined;
  }

  if (target.value.kind === "ip") {
    return target.value.address.version === 4 ? "ipv4" : "ipv6";
  }

  return target.value.kind === "asn" ? "asn" : "domain";
};

const canonicalQuery = (
  target: ReturnType<typeof parseRdapLookupTarget>
): string | undefined => {
  if (target._tag === "Err") {
    return undefined;
  }

  const { value } = target;

  if (value.kind === "ip") {
    return value.prefixLength === undefined
      ? value.address.canonical
      : `${value.address.canonical}/${value.prefixLength}`;
  }

  return value.kind === "asn" ? value.asn.canonical : value.domain;
};

const normalizeRecord = (
  kind: RdapNormalizedRecord["kind"],
  query: string,
  raw: RdapRawRecord,
  attribution: RdapNormalizedRecord["attribution"]
) =>
  Schema.decodeUnknownSync(RdapNormalizedRecordSchema)({
    kind,
    query,
    data: normalizeData(raw),
    attribution,
    raw,
  });

const getRegistry = (
  fetchJson: RdapJsonFetcher,
  kind: RegistryKind
): Effect.Effect<RdapBootstrapRegistry, ExternalProviderError> =>
  Effect.suspend(() => {
    let cache = registryCaches.get(fetchJson);

    if (cache === undefined) {
      cache = new Map();
      registryCaches.set(fetchJson, cache);
    }

    const cached = cache.get(kind);

    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return Effect.succeed(cached.registry);
    }

    return fetchJson(
      {
        provider: "iana-rdap-bootstrap",
        operation: `fetch-${kind}-bootstrap`,
        origin: IANA_ORIGIN,
        url: REGISTRY_URLS[kind],
      },
      RdapBootstrapRegistrySchema
    ).pipe(
      Effect.tap((registry) =>
        Effect.sync(() => {
          cache?.set(kind, {
            registry,
            expiresAt: Date.now() + REGISTRY_TTL_MS,
          });
        })
      )
    );
  });

const makeRdapService = (fetchJson: RdapJsonFetcher): RdapServiceContract => ({
  lookup: (lookup) =>
    Effect.gen(function* lookupRecord() {
      const parsed = parseRdapLookupTarget(lookup);
      const query = canonicalQuery(parsed);
      const kind = registryKind(parsed);

      if (query === undefined || kind === undefined) {
        return yield* Effect.fail(
          providerError("validate-lookup", "invalid-request")
        );
      }

      const registry = yield* getRegistry(fetchJson, kind);
      const discovery = discoverRdapService(registry, lookup);

      if (discovery._tag === "Err") {
        const reason =
          discovery.error._tag === "InvalidRdapLookupTarget"
            ? "invalid-request"
            : INVALID_RESPONSE;

        return yield* Effect.fail(providerError("discover-service", reason));
      }

      let failure = providerError("fetch-rdap-record", "transport");

      for (const baseUrl of discovery.value.baseUrls) {
        const queryUrl = buildRdapQueryUrl(baseUrl, lookup);

        if (queryUrl._tag === "Err") {
          failure = providerError("build-query-url", INVALID_RESPONSE);
        } else {
          const result = yield* Effect.result(
            fetchJson(
              {
                provider: "rdap-registry",
                operation: `fetch-${discovery.value.target.kind}`,
                origin: new URL(baseUrl).origin,
                url: queryUrl.value.href,
              },
              RdapRawRecordSchema
            )
          );

          if (result._tag === "Failure") {
            const { failure: lastFailure } = result;
            failure = lastFailure;
          } else {
            const { success: raw } = result;

            return normalizeRecord(discovery.value.target.kind, query, raw, {
              source: "third-party",
              registryUrl: REGISTRY_URLS[kind],
              registryPublication: discovery.value.publication,
              serviceUrl: baseUrl,
              queryUrl: queryUrl.value.href,
              matchedEntry: discovery.value.match,
            });
          }
        }
      }

      return yield* Effect.fail(failure);
    }),
});

/** Create the RDAP service over a bounded JSON transport.
 * @param fetchJson - Requester that enforces pinned HTTPS origins and response limits.
 * @returns A service Layer with successful IANA registries cached for one day.
 */
export const layer = (fetchJson: RdapJsonFetcher) =>
  Layer.succeed(RdapService, makeRdapService(fetchJson));

const fetchWithExternalProvider: RdapJsonFetcher = (request, schema) =>
  Effect.gen(function* fetchFromOrigin() {
    const client = yield* ExternalProviderHttpClient;

    return yield* client.getJson(
      {
        provider: request.provider,
        operation: request.operation,
        url: request.url,
      },
      schema
    );
  }).pipe(
    Effect.provide(
      externalProviderLayerLive({ [request.provider]: request.origin })
    )
  );

/** Production service with bounded Fetch requests and manual redirect handling. */
export const layerLive = layer(fetchWithExternalProvider);
