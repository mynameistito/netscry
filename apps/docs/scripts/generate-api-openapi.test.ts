import { describe, expect, it } from "vitest";

import { checkApiOpenApi, generateApiOpenApi } from "./generate-api-openapi";

describe("NetScry OpenAPI generation", () => {
  it("describes every implemented API route", async () => {
    const document = await generateApiOpenApi();

    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths)).toContain("/api/v1/domain/{domain}");
    expect(Object.keys(document.paths)).toContain("/api/v1/me/{endpoint}");
    expect(Object.keys(document.paths)).toHaveLength(22);
  });

  it("uses named response components produced by the canonical schemas", async () => {
    const document = await generateApiOpenApi();
    const components = document.components.schemas;

    expect(components).toHaveProperty("ApiHealthResponse");
    expect(components).toHaveProperty("ApiMeResponse");
    expect(components).toHaveProperty("PublicNetworkLookupResponse");
    expect(components).toHaveProperty("DnsLookupResponse");
    expect(components).toHaveProperty("RdapNormalizedRecord");
  });

  it("resolves every local JSON Schema reference to a generated component", async () => {
    const document = await generateApiOpenApi();
    const serialized = JSON.stringify(document);

    const references = [
      ...serialized.matchAll(/"\$ref":"(?<reference>#[^"]+)"/gu),
    ].map((match) => match.groups?.reference ?? "");

    for (const reference of references) {
      expect(reference).toBeDefined();
      expect(reference).toMatch(/^#\/components\/schemas\//u);
      expect(document.components.schemas).toHaveProperty(
        reference?.slice("#/components/schemas/".length)
      );
    }
  });

  it("keeps the checked-in API document current", async () => {
    await expect(checkApiOpenApi()).resolves.toBeUndefined();
  });
});
