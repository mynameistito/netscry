import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ExternalProviderErrorSchema } from "./errors.ts";

describe("external provider error contract", () => {
  it("decodes safe provider failure details", () => {
    const error = Schema.decodeUnknownSync(ExternalProviderErrorSchema)({
      _tag: "ExternalProviderError",
      provider: "example-rdap",
      operation: "lookup-ip",
      reason: "http-status",
      status: 503,
      retryable: true,
    });

    expect(error).toMatchObject({
      _tag: "ExternalProviderError",
      provider: "example-rdap",
      operation: "lookup-ip",
      reason: "http-status",
      status: 503,
      retryable: true,
    });
    expect(error).not.toHaveProperty("cause");
  });

  it("rejects unknown failure reasons and empty provider labels", () => {
    const decode = Schema.decodeUnknownSync(ExternalProviderErrorSchema);

    expect(() =>
      decode({
        _tag: "ExternalProviderError",
        provider: "",
        operation: "lookup-ip",
        reason: "network-failure",
        retryable: true,
      })
    ).toThrow(Schema.SchemaError);
  });
});
