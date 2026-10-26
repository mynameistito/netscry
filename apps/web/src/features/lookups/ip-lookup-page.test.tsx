// @vitest-environment jsdom

import {
  PublicBgpPrefixLookupResponseSchema,
  PublicNetworkLookupResponseSchema,
  RdapNormalizedRecordSchema,
} from "@netscry/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IpLookupPage } from "./ip-lookup-page";

const localFacts = Schema.decodeUnknownSync(PublicNetworkLookupResponseSchema)({
  kind: "address",
  input: "192.0.2.44",
  address: { address: "192.0.2.44", version: 4 },
  classification: {
    _tag: "Available",
    source: "derived",
    value: "documentation",
    sensitivity: "public",
  },
  classificationNote: {
    _tag: "Available",
    source: "derived",
    value: "Documentation use; not a routability guarantee.",
    sensitivity: "public",
  },
  provenance: {
    source: "derived",
    method: "selected-ip-purpose-ranges",
  },
});

const rdapRecord = Schema.decodeUnknownSync(RdapNormalizedRecordSchema)({
  kind: "ip",
  query: "192.0.2.44",
  data: {
    name: "Example network",
    handle: "EXAMPLE-1",
    type: "DIRECT ALLOCATION",
    country: "US",
    ipVersion: "v4",
    startAddress: "192.0.2.0",
    endAddress: "192.0.2.255",
    statuses: ["active"],
    events: [{ action: "registration", date: "2024-01-01T00:00:00Z" }],
    nameservers: [],
    entities: [],
  },
  attribution: {
    source: "third-party",
    registryUrl: "https://rdap.example/",
    registryPublication: "2026-01-01T00:00:00Z",
    serviceUrl: "https://rdap.example/",
    queryUrl: "https://rdap.example/ip/192.0.2.44",
    matchedEntry: "192.0.2.0/24",
  },
  raw: {},
});

const bgpResult = Schema.decodeUnknownSync(PublicBgpPrefixLookupResponseSchema)(
  {
    kind: "bgp-prefix",
    query: { prefix: "192.0.2.0/24", version: 4 },
    routes: [
      {
        prefix: { prefix: "192.0.2.0/24", version: 4 },
        originAsn: 64_500,
        rpkiState: "not-found",
        reportingPeers: [
          {
            peerAsn: 64_501,
            peerAddress: { address: "198.51.100.1", version: 4 },
            collector: "route-views.example",
            asPath: "64501 64500",
            communities: [],
            observedAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
    ],
    attribution: {
      provider: "RouteViews",
      queryUrl: "https://api.routeviews.org/prefix/192.0.2.0/24",
      coverage: "Partial collector view",
    },
  }
);

const payloads = {
  "/api/v1/ip/192.0.2.44": localFacts,
  "/api/v1/rdap/ip/192.0.2.44": rdapRecord,
  "/api/v1/bgp?prefix=192.0.2.44": bgpResult,
};

const getRequestUrl = (input: RequestInfo | URL) => {
  if (input instanceof Request) {
    return input.url;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input;
};

const getPayload = (url: string) =>
  Object.entries(payloads).find(([candidate]) => candidate === url)?.[1];

const renderPage = (query: string) => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <IpLookupPage query={query} />
    </QueryClientProvider>
  );
};

describe(IpLookupPage, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads local facts, RDAP registration, and independently attributed BGP routes", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(async (input) => {
      const url = getRequestUrl(input);
      const body = getPayload(url);

      const response =
        body === undefined
          ? Response.json(
              { error: { code: "not-found", message: "missing" } },
              { status: 404 }
            )
          : Response.json(body);

      return await Promise.resolve(response);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage("192.0.2.44");

    await screen.findByText("Example network");
    expect([
      screen.getByText("documentation") !== null,
      screen.getByText("AS64500") !== null,
      screen.getByText(/AS64501 · 64501 64500/u) !== null,
      screen.getByText(/not a complete view of global routing/u) !== null,
    ]).toStrictEqual([true, true, true, true]);
    expect(
      screen
        .getByRole("link", { name: /Open RDAP source/u })
        .getAttribute("href")
    ).toBe("https://rdap.example/ip/192.0.2.44");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.map(([url]) => getRequestUrl(url)).toSorted()
    ).toStrictEqual(Object.keys(payloads).toSorted());
  });

  it("shows a loading state for each source while lookups are pending", () => {
    const { promise } = Promise.withResolvers<Response>();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(async () => await promise);
    vi.stubGlobal("fetch", fetchMock);

    renderPage("192.0.2.44");

    expect([
      screen.getByLabelText("Loading local address facts") !== null,
      screen.getByLabelText("Loading RDAP registration") !== null,
      screen.getByLabelText("Loading BGP observations") !== null,
    ]).toStrictEqual([true, true, true]);
  });

  it("keeps local and routing results visible when RDAP independently fails", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(async (input) => {
      const url = getRequestUrl(input);

      const response =
        url === "/api/v1/rdap/ip/192.0.2.44"
          ? Response.json(
              {
                error: {
                  code: "unavailable",
                  message: "RDAP source is temporarily unavailable.",
                },
              },
              { status: 503 }
            )
          : Response.json(getPayload(url) ?? {});

      return await Promise.resolve(response);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage("192.0.2.44");

    await screen.findByText("RDAP source is temporarily unavailable.");
    expect(screen.getByText("documentation")).toBeTruthy();
    expect(screen.getByText("AS64500")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "RDAP data unavailable" })
    ).toBeTruthy();
  });

  it("supports canonical CIDR details and rejects unrelated or malformed targets before fetching", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    renderPage("192.0.2.0/24");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(
      fetchMock.mock.calls.map(([url]) => getRequestUrl(url)).toSorted()
    ).toStrictEqual([
      "/api/v1/bgp?prefix=192.0.2.0%2F24",
      "/api/v1/ip/192.0.2.0%2F24",
      "/api/v1/rdap/ip/192.0.2.0%2F24",
    ]);

    cleanup();
    fetchMock.mockClear();
    renderPage("not-an-ip");
    expect(
      screen.getByText("A valid IP address or network is required")
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
