// @vitest-environment jsdom

import { PublicAsnLookupResponseSchema } from "@netscry/schemas";
import type { PublicAsnLookupResponse } from "@netscry/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AsnLookupPage } from "./asn-lookup-page";

const asnResult: PublicAsnLookupResponse = Schema.decodeUnknownSync(
  PublicAsnLookupResponseSchema
)({
  kind: "asn",
  asn: 64_500,
  holder: {
    _tag: "Available",
    source: "third-party",
    value: "Example Network",
    sensitivity: "public",
  },
  announcedPrefixes: {
    _tag: "Available",
    source: "third-party",
    value: [
      { prefix: "192.0.2.0/24", version: 4 },
      { prefix: "2001:db8::/32", version: 6 },
    ],
    sensitivity: "public",
  },
  attribution: {
    rdapQueryUrl: "https://rdap.example/autnum/64500",
    routeViews: {
      provider: "RouteViews",
      queryUrl: "https://api.routeviews.org/guest/asn/64500",
      coverage: "Subset of RouteViews collectors; not a complete global view.",
    },
  },
});

const renderPage = (asn: string) => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <AsnLookupPage asn={asn} />
    </QueryClientProvider>
  );
};

describe(AsnLookupPage, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows holder registration, IPv4/IPv6 prefixes, attribution, and route links", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(asnResult));

    vi.stubGlobal("fetch", fetchMock);

    renderPage("AS064500");

    await screen.findByText("Example Network");

    expect([
      screen.getByText("AS64500") !== null,
      screen.getByText("192.0.2.0/24") !== null,
      screen.getByText("2001:db8::/32") !== null,
      screen.getByLabelText("IPv4 prefix count").textContent === "1",
      screen.getByLabelText("IPv6 prefix count").textContent === "1",
    ]).toStrictEqual([true, true, true, true, true]);
    expect(
      screen
        .getAllByRole("link", { name: /Observe routes/u })
        .map((link) => link.getAttribute("href"))
    ).toStrictEqual([
      "/bgp?prefix=192.0.2.0%2F24",
      "/bgp?prefix=2001%3Adb8%3A%3A%2F32",
    ]);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/asn/AS64500");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps route results visible when the RDAP holder is unavailable", async () => {
    const partialResult: PublicAsnLookupResponse = {
      ...asnResult,
      holder: {
        _tag: "Unavailable",
        source: "third-party",
        reason: "provider-failure",
        sensitivity: "public",
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(partialResult))
    );

    renderPage("64500");

    await screen.findByText("Holder name unavailable from the RDAP source.");

    expect(screen.getByText("192.0.2.0/24")).toBeTruthy();
    expect(
      screen.getByText(
        "Subset of RouteViews collectors; not a complete global view."
      )
    ).toBeTruthy();
  });

  it("shows unavailable-prefix and invalid-input states without fetching invalid ASNs", async () => {
    const unavailablePrefixes: PublicAsnLookupResponse = {
      ...asnResult,
      announcedPrefixes: {
        _tag: "Unavailable",
        source: "third-party",
        reason: "provider-failure",
        sensitivity: "public",
      },
    };

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(unavailablePrefixes));

    vi.stubGlobal("fetch", fetchMock);

    renderPage("64500");

    await screen.findByText(
      "Announced-prefix data is unavailable from RouteViews."
    );

    cleanup();
    fetchMock.mockClear();

    renderPage("4294967295");

    expect(screen.getByText("A valid ASN is required")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
