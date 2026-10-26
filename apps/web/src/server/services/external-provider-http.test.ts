import { ExternalProviderError } from "@netscry/schemas";
import { Effect, Layer, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientError,
  HttpClientResponse,
} from "effect/http";
import type { HttpClientRequest as HttpClientRequestType } from "effect/http/HttpClientRequest";
import { describe, expect, it } from "vitest";

import {
  EXTERNAL_PROVIDER_MAX_RESPONSE_BYTES,
  ExternalProviderHttpClient,
  layer,
  layerLive,
} from "./external-provider-http.ts";
import type { ExternalProviderRequest } from "./external-provider-http.ts";

const responseSchema = Schema.Struct({ value: Schema.String });

const providerRequest: ExternalProviderRequest = {
  provider: "example-provider",
  operation: "lookup",
  url: "https://api.example.test/lookup?name=sample",
};

const providerOrigins = {
  "example-provider": "https://api.example.test",
};

type FetchStub = (
  url: URL,
  signal: AbortSignal,
  request: HttpClientRequestType
) => Response | Promise<Response>;

const mockClient = (fetch: FetchStub) =>
  HttpClient.make((request, url, signal) =>
    Effect.tryPromise({
      try: async () =>
        HttpClientResponse.fromWeb(request, await fetch(url, signal, request)),
      catch: (cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause }),
        }),
    })
  );

const layerWithClient = (client: HttpClient.HttpClient) =>
  layer(providerOrigins).pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, client))
  );

const lookup = async (
  client: HttpClient.HttpClient,
  request = providerRequest
) =>
  await Effect.runPromise(
    Effect.gen(function* getJson() {
      const service = yield* ExternalProviderHttpClient;

      return yield* service.getJson(request, responseSchema);
    }).pipe(Effect.provide(layerWithClient(client)))
  );

const lookupFailure = async (
  client: HttpClient.HttpClient,
  request = providerRequest
) =>
  await Effect.runPromise(
    Effect.gen(function* getFailure() {
      const service = yield* ExternalProviderHttpClient;

      return yield* Effect.flip(service.getJson(request, responseSchema));
    }).pipe(Effect.provide(layerWithClient(client)))
  );

describe(ExternalProviderHttpClient, () => {
  it("decodes a JSON response through the shared Effect Schema", async () => {
    const result = await lookup(
      mockClient(() => Response.json({ value: "resolved" }, { status: 200 }))
    );

    expect(result).toStrictEqual({ value: "resolved" });
  });

  it("sends a validated provider-specific Accept header", async () => {
    let acceptHeader: string | undefined;

    const client = mockClient((_url, _signal, request) => {
      acceptHeader = request.headers.accept;

      return Response.json({ value: "resolved" }, { status: 200 });
    });

    const result = await lookup(client, {
      ...providerRequest,
      accept: "application/dns-json",
    });

    expect(result).toStrictEqual({ value: "resolved" });
    expect(acceptHeader).toBe("application/dns-json");
  });

  it("rejects invalid Accept header values before fetching", async () => {
    let requests = 0;

    const error = await lookupFailure(
      mockClient(() => {
        requests += 1;

        return Response.json({ value: "unexpected" });
      }),
      { ...providerRequest, accept: "application/json\r\nX-Injected: yes" }
    );

    expect(error).toMatchObject({
      reason: "invalid-request",
      retryable: false,
    });
    expect(requests).toBe(0);
  });

  it("rejects non-HTTPS and cross-origin requests before fetching", async () => {
    let requests = 0;

    const error = await lookupFailure(
      mockClient(() => {
        requests += 1;

        return Response.json({ value: "unexpected" });
      }),
      { ...providerRequest, url: "https://other.example.test/lookup" }
    );

    expect(error).toBeInstanceOf(ExternalProviderError);
    expect(error).toMatchObject({
      reason: "invalid-request",
      retryable: false,
    });
    expect(requests).toBe(0);
  });

  it("rejects unknown providers before fetching", async () => {
    let requests = 0;

    const error = await lookupFailure(
      mockClient(() => {
        requests += 1;

        return Response.json({ value: "unexpected" });
      }),
      { ...providerRequest, provider: "unconfigured-provider" }
    );

    expect(error).toMatchObject({ reason: "invalid-request" });
    expect(requests).toBe(0);
  });

  it("reports terminal HTTP statuses with safe structured details", async () => {
    const error = await lookupFailure(
      mockClient(() =>
        Response.json({ message: "private upstream body" }, { status: 404 })
      )
    );

    expect(error).toMatchObject({
      _tag: "ExternalProviderError",
      provider: "example-provider",
      operation: "lookup",
      reason: "http-status",
      status: 404,
      retryable: false,
    });
    expect(error).not.toHaveProperty("cause");
    expect(error.message).toContain("http-status");
    expect(error.message).not.toContain("private upstream body");
  });

  it("retries transient statuses no more than the configured two times", async () => {
    let requests = 0;

    const result = await lookup(
      mockClient(() => {
        requests += 1;

        return requests < 3
          ? Response.json({}, { status: 503 })
          : Response.json({ value: "recovered" });
      })
    );

    expect(result).toStrictEqual({ value: "recovered" });
    expect(requests).toBe(3);
  });

  it("rejects redirect responses without following them", async () => {
    let requests = 0;

    const error = await lookupFailure(
      mockClient(() => {
        requests += 1;

        return new Response(null, {
          status: 302,
          headers: { location: "https://elsewhere.example.test/" },
        });
      })
    );

    expect(error).toMatchObject({ reason: "http-status", status: 302 });
    expect(requests).toBe(1);
  });

  it("configures the production Fetch layer to keep redirects manual", async () => {
    const requestInit = await Effect.runPromise(
      Effect.gen(function* getRequestInit() {
        return yield* FetchHttpClient.RequestInit;
      }).pipe(Effect.provide(layerLive(providerOrigins)))
    );

    expect(requestInit.redirect).toBe("manual");
  });

  it("rejects oversized response streams before collecting them", async () => {
    const error = await lookupFailure(
      mockClient(
        () =>
          new Response(
            new Uint8Array(EXTERNAL_PROVIDER_MAX_RESPONSE_BYTES + 1),
            {
              headers: { "content-type": "application/json" },
            }
          )
      )
    );

    expect(error).toMatchObject({
      reason: "response-too-large",
      retryable: false,
    });
  });

  it("classifies invalid JSON and schema mismatches as invalid responses", async () => {
    const invalidJson = await lookupFailure(
      mockClient(
        () =>
          new Response("{", { headers: { "content-type": "application/json" } })
      )
    );

    const invalidSchema = await lookupFailure(
      mockClient(() => Response.json({ value: 42 }))
    );

    expect(invalidJson).toMatchObject({ reason: "invalid-response" });
    expect(invalidSchema).toMatchObject({ reason: "invalid-response" });
  });

  it("maps the total request timeout and interrupts the transport", async () => {
    let aborted = false;

    let transportSignal: AbortSignal | undefined;

    const client = HttpClient.make((_request, _url, signal) => {
      transportSignal = signal;

      return Effect.never.pipe(
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            aborted = true;
          })
        )
      );
    });

    const error = await lookupFailure(client, {
      ...providerRequest,
      timeoutMs: 5,
    });

    expect(error).toMatchObject({ reason: "timeout", retryable: true });
    expect(aborted).toBeTruthy();
    expect(transportSignal?.aborted).toBeTruthy();
  });
});
