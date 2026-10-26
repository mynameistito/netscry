// @vitest-environment jsdom

import { RdapNormalizedRecordSchema } from "@netscry/schemas";
import type { RdapNormalizedRecord } from "@netscry/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DomainLookupPage } from "./domain-lookup-page";

const domainRecord: RdapNormalizedRecord = Schema.decodeUnknownSync(
  RdapNormalizedRecordSchema
)({
  kind: "domain",
  query: "xn--bcher-kva.example",
  data: {
    handle: "EXAMPLE-42",
    type: "domain",
    country: "NZ",
    ldhName: "xn--bcher-kva.example",
    unicodeName: "bücher.example",
    statuses: ["client transfer prohibited", "active"],
    events: [
      { action: "registration", date: "2020-01-02T03:04:05Z" },
      { action: "expiration", date: "2027-01-02T03:04:05Z" },
    ],
    nameservers: ["ns1.example.net", "ns2.example.net"],
    entities: [
      {
        handle: "REG-1",
        roles: ["registrar", "abuse"],
        name: "Example Registrar",
        organizations: ["Example Registry Services"],
        emails: ["abuse@example.net"],
        phones: ["+64.12345678"],
      },
    ],
  },
  attribution: {
    source: "third-party",
    registryUrl: "https://data.iana.org/rdap/dns.json",
    registryPublication: "2026-01-01T00:00:00Z",
    serviceUrl: "https://rdap.example.net/",
    queryUrl: "https://rdap.example.net/domain/xn--bcher-kva.example",
    matchedEntry: "example",
  },
  raw: {
    objectClassName: "domain",
    ldhName: "xn--bcher-kva.example",
    nameservers: [{ ldhName: "ns1.example.net" }],
  },
});

const renderPage = (domain: string) => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <DomainLookupPage domain={domain} />
    </QueryClientProvider>
  );
};

describe(DomainLookupPage, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows normalized registration fields, public contacts, provenance, and DNS cross-link", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(domainRecord));

    vi.stubGlobal("fetch", fetchMock);

    renderPage("bücher.example");

    await screen.findByText("Example Registrar");
    expect({
      unicodeName: screen.getByText("bücher.example") !== null,
      asciiNameCount: screen.getAllByText("xn--bcher-kva.example").length,
      registrationDate: screen.getByText("2020-01-02T03:04:05Z") !== null,
      nameserver: screen.getByText("ns1.example.net") !== null,
      abuseEmail: screen
        .getByRole("link", { name: "abuse@example.net" })
        .getAttribute("href"),
      source: screen
        .getByRole("link", { name: "Open RDAP record" })
        .getAttribute("href"),
      rawRecord: screen.getByText(/objectClassName/u) !== null,
      dnsLink: screen
        .getByRole("link", { name: /Check DNS records/u })
        .getAttribute("href"),
    }).toStrictEqual({
      unicodeName: true,
      asciiNameCount: 2,
      registrationDate: true,
      nameserver: true,
      abuseEmail: "mailto:abuse@example.net",
      source: "https://rdap.example.net/domain/xn--bcher-kva.example",
      rawRecord: true,
      dnsLink: "/dns?query=xn--bcher-kva.example&type=A",
    });
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/rdap/domain/xn--bcher-kva.example");
  });

  it("keeps an unavailable RDAP response safe and does not fetch invalid domains", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "unavailable",
            message: "RDAP source is temporarily unavailable.",
          },
        },
        { status: 503 }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    renderPage("example.com");
    await screen.findByText("RDAP source is temporarily unavailable.");

    cleanup();
    fetchMock.mockClear();
    renderPage("bad_domain.example");

    expect(screen.getByText("A valid domain is required")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
