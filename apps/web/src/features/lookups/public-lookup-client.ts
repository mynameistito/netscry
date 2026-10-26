import { ApiErrorResponseSchema } from "@netscry/schemas";
import { Schema } from "effect";

/** Fetch and validate a public lookup response at the browser I/O boundary.
 * @param url - Same-origin versioned API path.
 * @param schema - Effect Schema decoder for the expected response contract.
 * @param signal - TanStack Query cancellation signal.
 * @param label - Safe source label used in user-facing error messages.
 * @returns The decoded response value.
 */
export const fetchPublicLookup = async <Value>(
  url: string,
  schema: Schema.Decoder<Value>,
  signal: AbortSignal,
  label: string
): Promise<Value> => {
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch {
    throw new Error(`The ${label} service could not be reached. Try again.`);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new Error(`The ${label} service returned an unreadable response.`);
  }

  if (!response.ok) {
    const error = Schema.decodeUnknownResult(ApiErrorResponseSchema)(body);
    throw new Error(
      error._tag === "Success"
        ? error.success.error.message
        : `The ${label} lookup could not be completed.`
    );
  }

  const result = Schema.decodeUnknownResult(schema)(body);

  if (result._tag === "Failure") {
    throw new Error(`The ${label} service returned unexpected data.`);
  }

  return result.success;
};
