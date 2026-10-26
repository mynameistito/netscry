import { Effect } from "effect";
import type { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { createNetScryClient } from "./client";
import type { NetScrySdkError } from "./client";

const healthResponse = {
  status: "ok",
  service: "netscry",
  version: "v1",
} as const;

type JsonValue = typeof Schema.Json.Type;

const jsonResponse = (body: JsonValue, status = 200) =>
  Response.json(body, { status });

const inputUrl = (input: RequestInfo | URL): string => {
  if (input instanceof URL) {
    return input.href;
  }

  if (input instanceof Request) {
    return input.url;
  }

  return input;
};

const expectInvalidResponse = async (
  request: Effect.Effect<unknown, NetScrySdkError>
): Promise<void> => {
  await expect(Effect.runPromise(request)).rejects.toMatchObject({
    _tag: "NetScrySdkError",
    reason: "invalid-response",
  });
};

describe(createNetScryClient, () => {
  it("injects the base URL and fetcher and decodes the shared health schema", async () => {
    const requests: { url: URL; headers: Headers }[] = [];

    const client = createNetScryClient({
      baseUrl: "https://api.example.test/prefix/",
      fetch: async (input, init) => {
        requests.push({
          url: new URL(inputUrl(input)),
          headers: new Headers(init?.headers),
        });

        await Promise.resolve();

        return jsonResponse(healthResponse);
      },
    });

    await expect(Effect.runPromise(client.health())).resolves.toStrictEqual(
      healthResponse
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.href).toBe(
      "https://api.example.test/api/v1/health"
    );
    expect(requests[0]?.headers.get("accept")).toBe("application/json");
  });

  it("encodes path and query input without changing the endpoint contract", async () => {
    const urls: string[] = [];

    const client = createNetScryClient({
      baseUrl: "https://api.example.test",
      fetch: async (input) => {
        urls.push(inputUrl(input));

        await Promise.resolve();

        return jsonResponse({});
      },
    });

    const requests: (() => Effect.Effect<unknown, NetScrySdkError>)[] = [
      () => client.lookupNetwork("192.0.2.0/24"),
      () => client.lookupAsn("AS64496"),
      () => client.lookupBgp("192.0.2.0/24"),
      () => client.lookupDns("example.com", "AAAA"),
      () => client.lookupRdapIp("192.0.2.0/24"),
      () => client.lookupRdapDomain("bücher.example"),
    ];

    await Promise.all(
      requests.map(async (makeRequest) => {
        await expectInvalidResponse(makeRequest());
      })
    );

    expect(urls).toStrictEqual([
      "https://api.example.test/api/v1/ip/192.0.2.0%2F24",
      "https://api.example.test/api/v1/asn/AS64496",
      "https://api.example.test/api/v1/bgp?prefix=192.0.2.0%2F24",
      "https://api.example.test/api/v1/dns/example.com?type=AAAA",
      "https://api.example.test/api/v1/rdap/ip/192.0.2.0%2F24",
      "https://api.example.test/api/v1/rdap/domain/b%C3%BCcher.example",
    ]);
  });

  it("returns the stable API error envelope as a typed SDK failure", async () => {
    const client = createNetScryClient({
      baseUrl: "https://api.example.test",
      fetch: async () => {
        await Promise.resolve();

        return jsonResponse(
          {
            error: { code: "rate-limited", message: "Try again later." },
          },
          429
        );
      },
    });

    await expect(Effect.runPromise(client.health())).rejects.toMatchObject({
      _tag: "NetScrySdkError",
      reason: "http",
      status: 429,
      code: "rate-limited",
      message: "Try again later.",
    });
  });

  it("keeps network, unreadable JSON, and invalid contract failures distinct", async () => {
    const networkFailure = createNetScryClient({
      baseUrl: "https://api.example.test",
      fetch: async () => {
        await Promise.resolve();

        throw new Error("private transport detail");
      },
    });

    const invalidJson = createNetScryClient({
      baseUrl: "https://api.example.test",
      fetch: async () => {
        await Promise.resolve();

        return new Response("not json", {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      },
    });

    const invalidContract = createNetScryClient({
      baseUrl: "https://api.example.test",
      fetch: async () => {
        await Promise.resolve();

        return jsonResponse({ status: "warming-up" });
      },
    });

    await expect(
      Effect.runPromise(networkFailure.health())
    ).rejects.toMatchObject({
      _tag: "NetScrySdkError",
      reason: "network",
    });
    await expect(Effect.runPromise(invalidJson.health())).rejects.toMatchObject(
      {
        _tag: "NetScrySdkError",
        reason: "invalid-json",
      }
    );
    await expect(
      Effect.runPromise(invalidContract.health())
    ).rejects.toMatchObject({
      _tag: "NetScrySdkError",
      reason: "invalid-response",
    });
  });

  it("reports invalid base URLs through the Effect error channel", async () => {
    let called = false;

    const client = createNetScryClient({
      baseUrl: "file:///private",
      fetch: async () => {
        called = true;

        await Promise.resolve();

        return jsonResponse(healthResponse);
      },
    });

    await expect(Effect.runPromise(client.health())).rejects.toMatchObject({
      _tag: "NetScrySdkError",
      reason: "configuration",
    });
    expect(called).toBeFalsy();
  });
});
