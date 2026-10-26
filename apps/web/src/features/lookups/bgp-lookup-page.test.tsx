// @vitest-environment jsdom

import { PublicBgpPrefixLookupResponseSchema } from "@netscry/schemas";
import type { PublicBgpPrefixLookupResponse } from "@netscry/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BgpLookupPage } from "./bgp-lookup-page";

const bgpResult: PublicBgpPrefixLookupResponse = Schema.decodeUnknownSync(
  PublicBgpPrefixLookupResponseSchema
)({
  kind: "bgp-prefix",
  query: { prefix: "192.0.2.0/24", version: 4 },
  routes: [
    {
      prefix: { prefix: "192.0.2.0/24", version: 4 },
      originAsn: 64_500,
      rpkiState: "valid",
      reportingPeers: [
        {
          peerAsn: 64_501,
          peerAddress: { address: "198.51.100.1", version: 4 },
          collector: "route-views.example",
          asPath: "64501 64500",
          communities: ["64501:100"],
          observedAt: "2026-10-27T00:00:00Z",
        },
        {
          peerAsn: 64_502,
          peerAddress: { address: "2001:db8::2", version: 6 },
          collector: "route-views6.example",
          asPath: "64502 64503 64500",
          communities: [],
          observedAt: "2026-10-27T00:01:00Z",
        },
      ],
    },
  ],
  attribution: {
    provider: "RouteViews",
    queryUrl: "https://api.routeviews.org/prefix/192.0.2.0/24",
    coverage: "Observed by participating RouteViews collectors.",
  },
});

const renderPage = (prefix: string) => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <BgpLookupPage prefix={prefix} />
    </QueryClientProvider>
  );
};

describe(BgpLookupPage, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows observed origins, peer paths, RPKI, timestamps, communities, and coverage", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(bgpResult));

    vi.stubGlobal("fetch", fetchMock);

    renderPage("192.0.2.1/24");

    await screen.findByText("64501 64500");

    expect([
      screen.getByText("AS64500") !== null,
      screen.getByText("route-views.example") !== null,
      screen.getByText("valid", { selector: "span" }) !== null,
      screen.getByText("64501:100") !== null,
      screen.getByText("2026-10-27T00:01:00Z") !== null,
      screen.getByText(/not a complete view of global routing/u) !== null,
    ]).toStrictEqual([true, true, true, true, true, true]);
    expect(
      screen
        .getByRole("link", { name: /ASN registration/u })
        .getAttribute("href")
    ).toBe("/asn/AS64500");
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/bgp?prefix=192.0.2.0%2F24");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("shows empty and invalid-prefix states without sending invalid queries", async () => {
    const emptyResult: PublicBgpPrefixLookupResponse = {
      ...bgpResult,
      routes: [],
    };

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(emptyResult));

    vi.stubGlobal("fetch", fetchMock);

    renderPage("2001:db8::/32");

    await screen.findByText("No routes observed");

    cleanup();
    fetchMock.mockClear();

    renderPage("example.com");

    expect(screen.getByText("A valid IP prefix is required")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a safe API error", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "unavailable",
            message: "RouteViews is temporarily unavailable.",
          },
        },
        { status: 503 }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    renderPage("192.0.2.0/24");

    await screen.findByText("RouteViews is temporarily unavailable.");

    expect(
      screen.getByRole("heading", { name: "BGP lookup unavailable" })
    ).toBeTruthy();
  });
});
