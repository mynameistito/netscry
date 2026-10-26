import { ExternalProviderError } from "@netscry/schemas";
import {
  Context,
  Effect,
  Layer,
  Option,
  Schedule,
  Schema,
  Stream,
} from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import type { HttpClientError as HttpClientErrorType } from "effect/http/HttpClientError";
import type { HttpClientResponse as HttpClientResponseType } from "effect/http/HttpClientResponse";

export const EXTERNAL_PROVIDER_TIMEOUT_MS = 8000;
export const EXTERNAL_PROVIDER_MAX_RESPONSE_BYTES = 1_048_576;

const INVALID_RESPONSE = "invalid-response" as const;
const INVALID_REQUEST = "invalid-request" as const;
const HTTPS_SCHEME = "https:";
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** A provider and URL that must resolve within its configured origin. */
export interface ExternalProviderRequest {
  readonly provider: string;
  readonly operation: string;
  readonly url: string;
  /** Optional tighter limits; callers cannot raise the service-wide caps. */
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}

/** Compile-time provider registry whose origins are owned by server code. */
export type ExternalProviderOrigins = Readonly<Record<string, string>>;

/** Bounded JSON lookup capability shared by external provider services. */
export interface ExternalProviderHttpClientContract {
  readonly getJson: <S extends Schema.Constraint>(
    request: ExternalProviderRequest,
    schema: S
  ) => Effect.Effect<S["Type"], ExternalProviderError, S["DecodingServices"]>;
}

/** Effect service for validated, bounded external provider requests. */
export class ExternalProviderHttpClient extends Context.Service<
  ExternalProviderHttpClient,
  ExternalProviderHttpClientContract
>()("@netscry/web/ExternalProviderHttpClient") {}

const makeProviderError = (
  request: ExternalProviderRequest,
  reason: ExternalProviderError["reason"],
  retryable: boolean,
  status?: number
) => {
  const fields = {
    provider: request.provider,
    operation: request.operation,
    reason,
    retryable,
  };

  return status === undefined
    ? new ExternalProviderError(fields)
    : new ExternalProviderError({ ...fields, status });
};

const isSecureHttpsUrl = (url: URL) =>
  url.protocol === HTTPS_SCHEME && url.username === "" && url.password === "";

const validateRequest = (
  request: ExternalProviderRequest,
  providerOrigins: ExternalProviderOrigins
):
  | {
      readonly url: URL;
      readonly timeoutMs: number;
      readonly maxResponseBytes: number;
    }
  | ExternalProviderError => {
  const provider = Schema.decodeUnknownResult(Schema.NonEmptyString)(
    request.provider
  );

  const operation = Schema.decodeUnknownResult(Schema.NonEmptyString)(
    request.operation
  );

  if (!(provider._tag === "Success" && operation._tag === "Success")) {
    return makeProviderError(request, INVALID_REQUEST, false);
  }

  const configuredOrigin = providerOrigins[request.provider];

  if (configuredOrigin === undefined) {
    return makeProviderError(request, INVALID_REQUEST, false);
  }

  const timeoutMs = request.timeoutMs ?? EXTERNAL_PROVIDER_TIMEOUT_MS;

  const maxResponseBytes =
    request.maxResponseBytes ?? EXTERNAL_PROVIDER_MAX_RESPONSE_BYTES;

  const hasValidTimeout =
    Number.isInteger(timeoutMs) &&
    timeoutMs >= 1 &&
    timeoutMs <= EXTERNAL_PROVIDER_TIMEOUT_MS;

  const hasValidSizeLimit =
    Number.isInteger(maxResponseBytes) &&
    maxResponseBytes >= 1 &&
    maxResponseBytes <= EXTERNAL_PROVIDER_MAX_RESPONSE_BYTES;

  if (!(hasValidTimeout && hasValidSizeLimit)) {
    return makeProviderError(request, INVALID_REQUEST, false);
  }

  try {
    const origin = new URL(configuredOrigin);

    if (!isSecureHttpsUrl(origin)) {
      return makeProviderError(request, INVALID_REQUEST, false);
    }

    const url = new URL(request.url, origin);

    if (!isSecureHttpsUrl(url)) {
      return makeProviderError(request, INVALID_REQUEST, false);
    }

    if (url.origin !== origin.origin || url.hash !== "") {
      return makeProviderError(request, INVALID_REQUEST, false);
    }

    return { url, timeoutMs, maxResponseBytes };
  } catch {
    return makeProviderError(request, INVALID_REQUEST, false);
  }
};

const mapHttpError = (
  request: ExternalProviderRequest,
  error: HttpClientErrorType
): ExternalProviderError => {
  const { reason } = error;

  if (reason._tag === "StatusCodeError") {
    const { status } = reason.response;

    return makeProviderError(
      request,
      "http-status",
      RETRYABLE_HTTP_STATUSES.has(status),
      status
    );
  }

  return makeProviderError(request, "transport", true);
};

const collectBody = (
  request: ExternalProviderRequest,
  response: HttpClientResponseType,
  maxResponseBytes: number
) => {
  const contentLength = response.headers["content-length"];

  const declaredLength =
    contentLength !== undefined && /^\d+$/u.test(contentLength)
      ? Number(contentLength)
      : undefined;

  if (declaredLength !== undefined && declaredLength > maxResponseBytes) {
    return Effect.fail(makeProviderError(request, "response-too-large", false));
  }

  const contentType = response.headers["content-type"]
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  const isJsonContentType =
    contentType === "application/json" ||
    (contentType !== undefined && contentType.endsWith("+json"));

  if (!isJsonContentType) {
    return Effect.fail(makeProviderError(request, INVALID_RESPONSE, false));
  }

  const emptyChunks: Uint8Array[] = [];

  const stream = response.stream.pipe(
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This synchronous transformer only converts typed stream failures.
    Stream.mapError((error) => mapHttpError(request, error))
  );

  return stream.pipe(
    Stream.runFoldEffect(
      () => ({ chunks: emptyChunks, size: 0 }),
      (current, chunk) => {
        const size = current.size + chunk.byteLength;

        return size > maxResponseBytes
          ? Effect.fail(makeProviderError(request, "response-too-large", false))
          : Effect.succeed({ chunks: [...current.chunks, chunk], size });
      }
    ),
    Effect.map(({ chunks, size }) => {
      const bytes = new Uint8Array(size);
      let offset = 0;

      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return bytes;
    })
  );
};

const readProviderJson = <S extends Schema.Constraint>(
  client: HttpClient.HttpClient,
  request: ExternalProviderRequest,
  schema: S,
  validated: {
    readonly url: URL;
    readonly maxResponseBytes: number;
  }
): Effect.Effect<S["Type"], ExternalProviderError, S["DecodingServices"]> => {
  const boundedClient = HttpClient.withScope(
    client.pipe(
      HttpClient.filterStatusOk,
      HttpClient.retryTransient({
        schedule: Schedule.exponential(100),
        times: 2,
      })
    )
  );

  return Effect.scoped(
    Effect.gen(function* readProviderResponse() {
      const response = yield* boundedClient
        .get(validated.url)
        .pipe(Effect.mapError((error) => mapHttpError(request, error)));

      const bytes = yield* collectBody(
        request,
        response,
        validated.maxResponseBytes
      );

      const json: unknown = yield* Effect.try({
        // SAFETY: The untrusted parsed value remains unknown until schema decoding succeeds.
        try: () => JSON.parse(new TextDecoder().decode(bytes)) as unknown,
        catch: () => makeProviderError(request, INVALID_RESPONSE, false),
      });

      return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
        Effect.mapError(() =>
          makeProviderError(request, INVALID_RESPONSE, false)
        )
      );
    })
  );
};

const withTimeout = <Value, Services>(
  effect: Effect.Effect<Value, ExternalProviderError, Services>,
  request: ExternalProviderRequest,
  timeoutMs: number
): Effect.Effect<Value, ExternalProviderError, Services> =>
  Effect.gen(function* runWithinTimeout() {
    const result = yield* Effect.timeoutOption(effect, timeoutMs);

    if (Option.isNone(result)) {
      return yield* Effect.fail(makeProviderError(request, "timeout", true));
    }

    return result.value;
  });

const makeService = (
  client: HttpClient.HttpClient,
  providerOrigins: ExternalProviderOrigins
): ExternalProviderHttpClientContract => {
  const getJson: ExternalProviderHttpClientContract["getJson"] = (
    request,
    schema
  ) => {
    const validated = validateRequest(request, providerOrigins);

    if (validated instanceof ExternalProviderError) {
      return Effect.fail(validated);
    }

    return withTimeout(
      readProviderJson(client, request, schema, validated),
      request,
      validated.timeoutMs
    );
  };

  return { getJson };
};

/**
 * Build a provider client pinned to origins supplied by trusted server code.
 * @param providerOrigins - Provider ids and their fixed HTTPS origins.
 * @returns A layer requiring an Effect HTTP client.
 */
export const layer = (providerOrigins: ExternalProviderOrigins) =>
  Layer.effect(
    ExternalProviderHttpClient,
    Effect.gen(function* createService() {
      return makeService(yield* HttpClient.HttpClient, providerOrigins);
    })
  );

/** Production Fetch layer with redirects disabled at the platform boundary. */
const fetchClientLayer = FetchHttpClient.layer.pipe(
  Layer.provideMerge(
    Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" })
  )
);

/**
 * Build the production provider client with Fetch redirects disabled.
 * @param providerOrigins - Provider ids and their fixed HTTPS origins.
 * @returns A layer with the Fetch client and bounded provider service.
 */
export const layerLive = (providerOrigins: ExternalProviderOrigins) =>
  layer(providerOrigins).pipe(Layer.provideMerge(fetchClientLayer));
