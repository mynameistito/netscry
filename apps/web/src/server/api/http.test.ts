import {
  ApiErrorResponseSchema,
  ApiHealthResponseSchema,
} from "@netscry/schemas";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  handleApiHealth,
  negotiateApiRepresentation,
  respondWithApiEffect,
} from "./http.ts";

const makeRequest = (accept?: string) =>
  new Request("https://netscry.example/api/v1/health", {
    headers: accept === undefined ? undefined : { accept },
  });

describe("API representation negotiation", () => {
  it("defaults to JSON when Accept is missing", () => {
    expect(
      negotiateApiRepresentation(makeRequest(), [
        "application/json",
        "text/plain",
      ])
    ).toBe("application/json");
  });

  it.each([
    ["application/json", "application/json"],
    ["*/*", "application/json"],
    ["text/plain;q=0.8, application/json;q=0.5", "text/plain"],
    ["application/json;q=0, */*;q=1", "text/plain"],
    ["application/*;q=0.9", "application/json"],
  ] as const)(
    "selects a supported response for Accept: %s",
    (accept, expected) => {
      expect(
        negotiateApiRepresentation(makeRequest(accept), [
          "application/json",
          "text/plain",
        ])
      ).toBe(expected);
    }
  );

  it.each(["text/html", "application/json;q=2", "application/json;q=0"])(
    "rejects unsupported Accept: %s",
    (accept) => {
      expect(
        negotiateApiRepresentation(makeRequest(accept), ["application/json"])
      ).toBeUndefined();
    }
  );
});

describe("versioned API health handler", () => {
  it("returns a schema-validated health response with security and no-store headers", async () => {
    const response = await handleApiHealth(makeRequest("application/json"));

    const body = Schema.decodeUnknownSync(ApiHealthResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toStrictEqual(
      expect.objectContaining({
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        "content-type": "application/json; charset=utf-8",
        "referrer-policy": "no-referrer",
        vary: "Accept",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      })
    );
    expect(body).toStrictEqual({
      status: "ok",
      service: "netscry",
      version: "v1",
    });
  });

  it("returns a typed 406 error when JSON is not acceptable", async () => {
    const response = await handleApiHealth(makeRequest("text/html"));

    expect(response.status).toBe(406);

    expect(
      Schema.decodeUnknownSync(ApiErrorResponseSchema)(await response.json())
    ).toStrictEqual({
      error: {
        code: "not-acceptable",
        message: "This endpoint only supports application/json.",
      },
    });
  });

  it("maps typed Effect failures and invalid response data to a safe typed 500", async () => {
    const failure = await respondWithApiEffect(
      makeRequest("application/json"),
      Schema.Struct({ value: Schema.String }),
      Effect.fail(new Error("private provider detail"))
    );

    const invalid = await respondWithApiEffect(
      makeRequest("application/json"),
      Schema.Struct({ value: Schema.String }),
      Effect.succeed({ value: 42 })
    );

    const [failureBody, invalidBody] = await Promise.all([
      failure.json(),
      invalid.json(),
    ]);

    expect([failure.status, invalid.status]).toStrictEqual([500, 500]);
    expect(JSON.stringify([failureBody, invalidBody])).not.toContain(
      "private provider detail"
    );
    expect(
      [failureBody, invalidBody].map((body) =>
        Schema.decodeUnknownSync(ApiErrorResponseSchema)(body)
      )
    ).toStrictEqual([
      {
        error: {
          code: "internal-error",
          message: "The request could not be completed.",
        },
      },
      {
        error: {
          code: "internal-error",
          message: "The request could not be completed.",
        },
      },
    ]);
  });
});
