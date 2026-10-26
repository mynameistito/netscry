import {
  ApiErrorResponseSchema,
  ApiHealthResponseSchema,
} from "@netscry/schemas";
import type { ApiErrorResponse, ApiHealthResponse } from "@netscry/schemas";
import { Effect, Schema } from "effect";

type ApiRepresentation = "application/json" | "text/plain";

interface AcceptedMediaRange {
  readonly mediaType: string;
  readonly quality: number;
}

interface RepresentationPreference {
  readonly quality: number;
  readonly specificity: number;
}

const API_SECURITY_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  Vary: "Accept",
} satisfies HeadersInit;

const parseAcceptHeader = (header: string): readonly AcceptedMediaRange[] =>
  header.split(",").flatMap((entry) => {
    const [mediaTypePart, ...parameters] = entry
      .split(";")
      .map((part) => part.trim().toLowerCase());

    const mediaType = mediaTypePart ?? "";

    if (mediaType.length === 0) {
      return [];
    }

    const qualityParameter = parameters.find((parameter) =>
      parameter.startsWith("q=")
    );

    const rawQuality = qualityParameter?.slice(2);

    const quality = rawQuality === undefined ? 1 : Number(rawQuality);

    return [
      {
        mediaType,
        quality:
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
      },
    ];
  });

const mediaRangeSpecificity = (range: string, target: ApiRepresentation) => {
  if (range === target) {
    return 2;
  }

  if (range === "*/*") {
    return 0;
  }

  const [rangeType, rangeSubtype] = range.split("/");
  const [targetType] = target.split("/");

  return rangeType === targetType && rangeSubtype === "*" ? 1 : -1;
};

const preferenceFor = (
  ranges: readonly AcceptedMediaRange[],
  target: ApiRepresentation
): RepresentationPreference => {
  let specificity = -1;
  let quality = 0;

  for (const range of ranges) {
    const { mediaType, quality: rangeQuality } = range;
    const currentSpecificity = mediaRangeSpecificity(mediaType, target);

    if (currentSpecificity > specificity) {
      specificity = currentSpecificity;
      quality = rangeQuality;
    } else if (currentSpecificity === specificity) {
      quality = Math.max(quality, rangeQuality);
    }
  }

  if (specificity < 0) {
    return { quality: 0, specificity: -1 };
  }

  return { quality, specificity };
};

/**
 * Select an acceptable representation, preferring JSON when qualities tie.
 * @param request - Incoming API request.
 * @param supported - Representations this endpoint can return.
 * @returns The preferred representation, or undefined when none are acceptable.
 */
export const negotiateApiRepresentation = (
  request: Request,
  supported: readonly ApiRepresentation[]
): ApiRepresentation | undefined => {
  const acceptHeader = request.headers.get("accept");

  if (acceptHeader === null || acceptHeader.trim().length === 0) {
    if (supported.includes("application/json")) {
      return "application/json";
    }

    return supported[0];
  }

  const ranges = parseAcceptHeader(acceptHeader);

  const preferences: (RepresentationPreference & {
    readonly order: number;
    readonly representation: ApiRepresentation;
  })[] = [];

  for (const [order, representation] of supported.entries()) {
    const preference = preferenceFor(ranges, representation);

    if (preference.quality > 0) {
      preferences.push({ order, representation, ...preference });
    }
  }

  return preferences.toSorted(
    (left, right) =>
      right.quality - left.quality ||
      right.specificity - left.specificity ||
      left.order - right.order
  )[0]?.representation;
};

const apiJsonResponse = (body: typeof Schema.Json.Type, status = 200) =>
  new Response(JSON.stringify(body) ?? "null", {
    headers: API_SECURITY_HEADERS,
    status,
  });

const apiErrorResponse = (
  code: ApiErrorResponse["error"]["code"],
  message: string,
  status: number
) => {
  const body = Schema.decodeUnknownSync(ApiErrorResponseSchema)({
    error: { code, message },
  });

  return apiJsonResponse(body, status);
};

/**
 * Validate an Effect result against its wire schema before creating a response.
 * @param request - Incoming API request.
 * @param schema - Shared response contract.
 * @param effect - Effect that produces the response value.
 * @returns A secured JSON response with an explicit status.
 */
export const respondWithApiEffect = async <
  ResponseBody extends typeof Schema.Json.Type,
  Failure,
>(
  request: Request,
  schema: Schema.ConstraintDecoder<ResponseBody>,
  effect: Effect.Effect<unknown, Failure>
): Promise<Response> => {
  const representation = negotiateApiRepresentation(request, [
    "application/json",
  ]);

  if (representation === undefined) {
    return apiErrorResponse(
      "not-acceptable",
      "This endpoint only supports application/json.",
      406
    );
  }

  const responseEffect = Effect.gen(function* renderApiResponse() {
    const value = yield* effect;

    return yield* Schema.decodeUnknownEffect(schema)(value);
  }).pipe(
    Effect.match({
      onFailure: () =>
        apiErrorResponse(
          "internal-error",
          "The request could not be completed.",
          500
        ),
      onSuccess: (body) => apiJsonResponse(body),
    })
  );

  try {
    return await Effect.runPromise(responseEffect);
  } catch {
    return apiErrorResponse(
      "internal-error",
      "The request could not be completed.",
      500
    );
  }
};

/**
 * Return a schema-validated health document for API monitoring clients.
 * @param request - Incoming health request.
 * @returns A no-store health response.
 */
export const handleApiHealth = async (request: Request) =>
  await respondWithApiEffect(
    request,
    ApiHealthResponseSchema,
    Effect.succeed<ApiHealthResponse>({
      status: "ok",
      service: "netscry",
      version: "v1",
    })
  );
