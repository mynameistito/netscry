import {
  ApiMeAsnResponseSchema,
  ApiMeColoResponseSchema,
  ApiMeCountryResponseSchema,
  ApiMeHeadersResponseSchema,
  ApiMeIpResponseSchema,
  ApiMeResponseSchema,
  ApiMeTraceResponseSchema,
  ConnectionMetadataSchema,
  EdgeMetadataSchema,
  GeographicLocationSchema,
  NetworkIdentitySchema,
  RawCloudflareMetadataSchema,
  SecurityMetadataSchema,
} from "@netscry/schemas";
import { Effect, Result, Schema } from "effect";

import { sanitizeRawCloudflareMetadata } from "../services/raw-cloudflare-metadata.ts";
import {
  layerLive,
  layerLocal,
  VisitorMetadataService,
} from "../services/visitor-metadata.ts";
import type { VisitorMetadataRequest } from "../services/visitor-metadata.ts";
import { apiErrorResponse, respondWithApiEffect } from "./http.ts";

type RuntimeMode = "live" | "local";

const layerFor = (mode: RuntimeMode) =>
  mode === "local" ? layerLocal : layerLive;

const IncomingRequestCfMarkerSchema = Schema.Struct({
  colo: Schema.NonEmptyString,
});

const isIncomingWorkerCf = (
  properties: Request["cf"]
): properties is IncomingRequestCfProperties =>
  properties !== undefined &&
  Result.isSuccess(
    Schema.decodeUnknownResult(IncomingRequestCfMarkerSchema)(properties)
  );

const visitorRequest = (request: Request): VisitorMetadataRequest => {
  const { cf } = request;

  // Worker API requests are inbound; Cloudflare's required `colo` field distinguishes request metadata from RequestInit.cf options.
  return {
    headers: request.headers,
    cf: isIncomingWorkerCf(cf) ? cf : undefined,
  };
};

const visitorEffect = <Value, Failure>(
  request: Request,
  mode: RuntimeMode,
  select: (
    service: typeof VisitorMetadataService.Service,
    visitor: VisitorMetadataRequest
  ) => Effect.Effect<Value, Failure>
) =>
  Effect.gen(function* getVisitorValue() {
    const service = yield* VisitorMetadataService;

    return yield* select(service, visitorRequest(request));
  }).pipe(Effect.provide(layerFor(mode)));

const headerField = (request: Request, name: string) => {
  const value = request.headers.get(name);

  if (value === null) {
    return {
      _tag: "Unavailable" as const,
      source: "request-header" as const,
      reason: "not-provided" as const,
      sensitivity: "personal" as const,
    };
  }

  return {
    _tag: "Available" as const,
    source: "request-header" as const,
    value,
    sensitivity: "personal" as const,
  };
};

const requestHeadersEffect = (request: Request) =>
  Schema.decodeUnknownEffect(ApiMeHeadersResponseSchema)({
    accept: headerField(request, "accept"),
    acceptLanguage: headerField(request, "accept-language"),
    acceptEncoding: headerField(request, "accept-encoding"),
    userAgent: headerField(request, "user-agent"),
    secChUa: headerField(request, "sec-ch-ua"),
    secChUaMobile: headerField(request, "sec-ch-ua-mobile"),
    secChUaPlatform: headerField(request, "sec-ch-ua-platform"),
  });

const meSnapshot = (request: Request, mode: RuntimeMode) =>
  visitorEffect(request, mode, (service, visitor) => service.read(visitor));

const endpointHandlers = {
  ip: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      ApiMeIpResponseSchema,
      visitorEffect(request, mode, (service, visitor) =>
        Effect.gen(function* getIp() {
          return { ip: yield* service.readIp(visitor) };
        })
      ),
      {
        plainText: ({ ip }) =>
          ip._tag === "Available" ? ip.value.address : null,
      }
    ),
  asn: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      ApiMeAsnResponseSchema,
      visitorEffect(request, mode, (service, visitor) =>
        Effect.gen(function* getAsn() {
          const [asn, name] = yield* Effect.all([
            service.readAsn(visitor),
            service.readAsOrganization(visitor),
          ]);

          return { asn, name };
        })
      ),
      {
        plainText: ({ asn }) =>
          asn._tag === "Available" ? String(asn.value) : null,
      }
    ),
  country: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      ApiMeCountryResponseSchema,
      visitorEffect(request, mode, (service, visitor) =>
        Effect.gen(function* getCountry() {
          return { country: yield* service.readCountry(visitor) };
        })
      ),
      {
        plainText: ({ country }) =>
          country._tag === "Available" ? country.value : null,
      }
    ),
  colo: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      ApiMeColoResponseSchema,
      visitorEffect(request, mode, (service, visitor) =>
        Effect.gen(function* getColo() {
          return { colo: yield* service.readColo(visitor) };
        })
      ),
      {
        plainText: ({ colo }) =>
          colo._tag === "Available" ? colo.value : null,
      }
    ),
  location: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      GeographicLocationSchema,
      Effect.map(meSnapshot(request, mode), ({ location }) => location)
    ),
  network: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      NetworkIdentitySchema,
      Effect.map(meSnapshot(request, mode), ({ network }) => network)
    ),
  edge: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      EdgeMetadataSchema,
      Effect.map(meSnapshot(request, mode), ({ edge }) => edge)
    ),
  connection: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      ConnectionMetadataSchema,
      Effect.map(meSnapshot(request, mode), ({ connection }) => connection)
    ),
  security: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      SecurityMetadataSchema,
      Effect.map(meSnapshot(request, mode), ({ security }) => security)
    ),
  headers: async (request: Request) =>
    await respondWithApiEffect(
      request,
      ApiMeHeadersResponseSchema,
      requestHeadersEffect(request)
    ),
  trace: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      ApiMeTraceResponseSchema,
      Effect.map(meSnapshot(request, mode), ({ edge }) => ({
        rayId: edge.rayId,
        colo: edge.colo,
      }))
    ),
  raw: async (request: Request, mode: RuntimeMode) =>
    await respondWithApiEffect(
      request,
      RawCloudflareMetadataSchema,
      sanitizeRawCloudflareMetadata({
        headers: request.headers,
        cf: isIncomingWorkerCf(request.cf) ? request.cf : undefined,
        source: mode === "local" ? "local-runtime" : "cloudflare-request",
      })
    ),
} satisfies Record<
  string,
  (request: Request, mode: RuntimeMode) => Promise<Response>
>;

type MeEndpoint = keyof typeof endpointHandlers;

const isMeEndpoint = (endpoint: string): endpoint is MeEndpoint =>
  Object.hasOwn(endpointHandlers, endpoint);

/**
 * Return one request-scoped visitor endpoint with shared schema and HTTP behavior.
 * @param request - Current API request.
 * @param endpoint - Granular endpoint name following `/api/v1/me/`.
 * @param mode - Runtime data source mode.
 * @returns The negotiated, schema-validated API response.
 */
export const handleMeApiRequest = async (
  request: Request,
  endpoint: string,
  mode: RuntimeMode = import.meta.env.DEV ? "local" : "live"
): Promise<Response> => {
  if (!isMeEndpoint(endpoint)) {
    return apiErrorResponse(
      "not-found",
      "The requested visitor endpoint does not exist.",
      404
    );
  }

  return await endpointHandlers[endpoint](request, mode);
};

/**
 * Return the complete normalized snapshot for the current request.
 * @param request - Current API request.
 * @param mode - Runtime data source mode.
 * @returns The schema-validated visitor snapshot.
 */
export const handleMeApiOverview = async (
  request: Request,
  mode: RuntimeMode = import.meta.env.DEV ? "local" : "live"
): Promise<Response> =>
  await respondWithApiEffect(
    request,
    ApiMeResponseSchema,
    meSnapshot(request, mode)
  );
