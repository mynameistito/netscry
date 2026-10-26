import { ExternalProviderError } from "@netscry/schemas";
import {
  Cache,
  Context,
  Duration,
  Effect,
  Exit,
  Layer,
  Result,
  Schema,
} from "effect";

const CACHE_CAPACITY = 512;
const MAX_CACHE_CAPACITY = 10_000;
const MAX_KEY_LENGTH = 512;
const DECODE_KEY_OPERATION = "decode-key";
const VALIDATE_KEY_OPERATION = "validate-key";

/** Public data categories accepted by the shared lookup cache. */
export const PublicLookupNamespaceSchema = Schema.Literals([
  "ip",
  "asn",
  "domain",
  "rdap",
  "dns",
  "bgp",
]);

/** Public lookup key contract, inferred from its Effect Schema. */
export const PublicLookupCacheKeySchema = Schema.Struct({
  namespace: PublicLookupNamespaceSchema,
  value: Schema.NonEmptyString,
  variant: Schema.optionalKey(Schema.NonEmptyString),
});

/** Public lookup key inferred from {@link PublicLookupCacheKeySchema}. */
export type PublicLookupCacheKey = typeof PublicLookupCacheKeySchema.Type;

/** Typed cache operations for one public lookup value type. */
export interface PublicLookupCacheContract {
  readonly get: <S extends Schema.Constraint>(
    key: PublicLookupCacheKey,
    schema: S
  ) => Effect.Effect<S["Type"], ExternalProviderError, S["DecodingServices"]>;
  readonly invalidate: (
    key: PublicLookupCacheKey
  ) => Effect.Effect<void, ExternalProviderError>;
  readonly clear: () => Effect.Effect<void>;
}

/** Per-provider Effect cache for public network lookup data. */
export class PublicLookupCache extends Context.Service<
  PublicLookupCache,
  PublicLookupCacheContract
>()("@netscry/web/PublicLookupCache") {}

/** Options for a namespaced public lookup cache Layer. */
export interface PublicLookupCacheOptions<Value> {
  readonly namespace: typeof PublicLookupNamespaceSchema.Type;
  readonly lookup: (
    key: PublicLookupCacheKey
  ) => Effect.Effect<Value, ExternalProviderError>;
  readonly capacity?: number;
  readonly timeToLive?: Duration.Input;
}

const cacheError = (
  operation: string,
  reason: ExternalProviderError["reason"] = "invalid-request"
) =>
  new ExternalProviderError({
    provider: "public-cache",
    operation,
    reason,
    retryable: false,
  });

const isValidKeyPart = (value: string | undefined) =>
  value === undefined || (value.length > 0 && value.length <= MAX_KEY_LENGTH);

const normalizeKey = (
  key: PublicLookupCacheKey,
  namespace: PublicLookupCacheOptions<unknown>["namespace"]
): PublicLookupCacheKey | ExternalProviderError => {
  const decoded = Schema.decodeUnknownResult(PublicLookupCacheKeySchema)(key);

  if (Result.isFailure(decoded)) {
    return cacheError(VALIDATE_KEY_OPERATION);
  }

  if (decoded.success.namespace !== namespace) {
    return cacheError(VALIDATE_KEY_OPERATION);
  }

  const value = decoded.success.value.trim();
  const variant = decoded.success.variant?.trim();

  if (!isValidKeyPart(value) || !isValidKeyPart(variant)) {
    return cacheError(VALIDATE_KEY_OPERATION);
  }

  return variant === undefined
    ? { namespace, value }
    : { namespace, value, variant };
};

const serializeKey = (key: PublicLookupCacheKey) => JSON.stringify(key);

const decodeKey = (
  serialized: string,
  namespace: PublicLookupCacheOptions<unknown>["namespace"]
): Effect.Effect<PublicLookupCacheKey, ExternalProviderError> =>
  Effect.gen(function* decodeCacheKey() {
    const input: unknown = yield* Effect.try({
      // SAFETY: The parsed JSON stays untrusted until the schema below validates it.
      try: () => JSON.parse(serialized) as unknown,
      catch: () => cacheError(DECODE_KEY_OPERATION),
    });

    const key = yield* Schema.decodeUnknownEffect(PublicLookupCacheKeySchema)(
      input
    ).pipe(Effect.mapError(() => cacheError(DECODE_KEY_OPERATION)));

    if (key.namespace !== namespace) {
      return yield* Effect.fail(cacheError(DECODE_KEY_OPERATION));
    }

    return key;
  });

const decodeCachedValue = <Value, S extends Schema.Constraint>(
  schema: S,
  effect: Effect.Effect<Value, ExternalProviderError>
): Effect.Effect<S["Type"], ExternalProviderError, S["DecodingServices"]> =>
  effect.pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.mapError(() => cacheError("decode-value", "invalid-response"))
      )
    )
  );

/**
 * Create an Effect Cache layer scoped to one public lookup namespace.
 * Successful values use the configured TTL; provider failures are not cached.
 * @param options - Fixed public lookup loader, namespace, TTL, and capacity.
 * @returns A typed cache service layer for the configured value type.
 */
export const layer = <Value>(options: PublicLookupCacheOptions<Value>) =>
  Layer.effect(
    PublicLookupCache,
    Effect.gen(function* createPublicLookupCache() {
      const capacity = options.capacity ?? CACHE_CAPACITY;

      if (
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > MAX_CACHE_CAPACITY
      ) {
        return yield* Effect.die(
          new RangeError("Public lookup cache capacity is outside its limits")
        );
      }

      const cache = yield* Cache.makeWith<string, Value, ExternalProviderError>(
        (serialized) =>
          Effect.gen(function* loadPublicLookup() {
            const key = yield* decodeKey(serialized, options.namespace);

            return yield* options.lookup(key);
          }),
        {
          capacity,
          timeToLive: (exit) =>
            Exit.isSuccess(exit)
              ? (options.timeToLive ?? "5 minutes")
              : Duration.zero,
        }
      );

      return PublicLookupCache.of({
        get: (input, schema) => {
          const key = normalizeKey(input, options.namespace);

          return key instanceof ExternalProviderError
            ? Effect.fail(key)
            : decodeCachedValue(schema, Cache.get(cache, serializeKey(key)));
        },
        invalidate: (input) => {
          const key = normalizeKey(input, options.namespace);

          return key instanceof ExternalProviderError
            ? Effect.fail(key)
            : Cache.invalidate(cache, serializeKey(key));
        },
        clear: () => Cache.invalidateAll(cache),
      });
    })
  );
