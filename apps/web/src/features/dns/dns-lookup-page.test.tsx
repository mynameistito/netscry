// @vitest-environment jsdom

import { DnsLookupResponseSchema } from "@netscry/schemas";
import type { DnsRecordType } from "@netscry/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DnsLookupPage } from "./dns-lookup-page";

const dnsAnswer = Schema.decodeUnknownSync(DnsLookupResponseSchema)({
  query: "example.com",
  recordType: "A",
  status: 0,
  truncated: false,
  dnssecAuthenticated: true,
  records: [
    {
      name: "example.com",
      type: "A",
      ttl: 300,
      data: { type: "A", address: { version: 4, canonical: "192.0.2.5" } },
    },
  ],
  cacheTtlSeconds: 300,
  attribution: {
    resolver: "Cloudflare 1.1.1.1",
    resolverUrl: "https://cloudflare-dns.com/dns-query",
  },
});

const response = (body: typeof Schema.Json.Type, status = 200) =>
  Response.json(body, { status });

interface PageProps {
  readonly initialQuery?: string;
  readonly initialType: DnsRecordType;
}

const renderPage = (props: PageProps) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  const page = (pageProps: PageProps) => (
    <QueryClientProvider client={queryClient}>
      <DnsLookupPage {...pageProps} />
    </QueryClientProvider>
  );

  const rendered = render(page(props));

  return {
    ...rendered,
    rerenderPage: (nextProps: PageProps) => {
      rendered.rerender(page(nextProps));
    },
  };
};

const dnsRecordCases = [
  {
    recordType: "A",
    answer: "192.0.2.5",
    record: {
      name: "example.com",
      type: "A",
      ttl: 300,
      data: { type: "A", address: { version: 4, canonical: "192.0.2.5" } },
    },
  },
  {
    recordType: "AAAA",
    answer: "2001:db8::5",
    record: {
      name: "example.com",
      type: "AAAA",
      ttl: 300,
      data: {
        type: "AAAA",
        address: { version: 6, canonical: "2001:db8::5" },
      },
    },
  },
  {
    recordType: "CAA",
    answer: '0 issue "letsencrypt.org"',
    record: {
      name: "example.com",
      type: "CAA",
      ttl: 300,
      data: { type: "CAA", flags: 0, tag: "issue", value: "letsencrypt.org" },
    },
  },
  {
    recordType: "CNAME",
    answer: "www.example.com.",
    record: {
      name: "example.com",
      type: "CNAME",
      ttl: 300,
      data: { type: "CNAME", target: "www.example.com." },
    },
  },
  {
    recordType: "MX",
    answer: "10 mail.example.com.",
    record: {
      name: "example.com",
      type: "MX",
      ttl: 300,
      data: { type: "MX", preference: 10, exchange: "mail.example.com." },
    },
  },
  {
    recordType: "NS",
    answer: "ns1.example.com.",
    record: {
      name: "example.com",
      type: "NS",
      ttl: 300,
      data: { type: "NS", target: "ns1.example.com." },
    },
  },
  {
    recordType: "PTR",
    answer: "host.example.net.",
    record: {
      name: "5.2.0.192.in-addr.arpa.",
      type: "PTR",
      ttl: 300,
      data: { type: "PTR", target: "host.example.net." },
    },
  },
  {
    recordType: "SOA",
    answer:
      "ns1.example.com. hostmaster.example.com. 2026010101 3600 600 1209600 300",
    record: {
      name: "example.com",
      type: "SOA",
      ttl: 300,
      data: {
        type: "SOA",
        mname: "ns1.example.com.",
        rname: "hostmaster.example.com.",
        serial: 2_026_010_101,
        refresh: 3600,
        retry: 600,
        expire: 1_209_600,
        minimum: 300,
      },
    },
  },
  {
    recordType: "SRV",
    answer: "5 10 443 service.example.com.",
    record: {
      name: "_https._tcp.example.com",
      type: "SRV",
      ttl: 300,
      data: {
        type: "SRV",
        priority: 5,
        weight: 10,
        port: 443,
        target: "service.example.com.",
      },
    },
  },
  {
    recordType: "TXT",
    answer: "v=spf1 -all",
    record: {
      name: "example.com",
      type: "TXT",
      ttl: 300,
      data: { type: "TXT", text: "v=spf1 -all" },
    },
  },
] as const;

describe(DnsLookupPage, () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("provides an empty search state with all supported record types", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    renderPage({ initialType: "A" });

    expect(screen.getByText("Ready for a DNS query")).toBeTruthy();
    expect(
      screen.getByLabelText("Domain, reverse-DNS name, or address")
    ).toBeTruthy();
    expect(screen.getByLabelText("Record type").children).toHaveLength(10);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the selected query and renders typed records, source, TTL, and DNSSEC", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(dnsAnswer));

    vi.stubGlobal("fetch", fetchMock);

    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderPage({ initialQuery: "example.com", initialType: "A" });

    await screen.findByText("Cloudflare 1.1.1.1");
    const [url, options] = fetchMock.mock.calls[0] ?? [];

    expect({
      url,
      signalIsAbortSignal: options?.signal instanceof AbortSignal,
    }).toStrictEqual({
      url: "/api/v1/dns/example.com?type=A",
      signalIsAbortSignal: true,
    });
    expect(screen.getByText("192.0.2.5")).toBeTruthy();
    expect(screen.getByText("300 s")).toBeTruthy();
    expect(
      screen.getByText("DNSSEC: authenticated by the resolver")
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Resolver endpoint" })
        .getAttribute("href")
    ).toBe("https://cloudflare-dns.com/dns-query");

    fireEvent.click(screen.getByRole("button", { name: "Copy A answer 1" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("192.0.2.5");
      expect(screen.getByText("DNS answer copied.")).toBeTruthy();
    });
  });

  it("links a normalized domain to its RDAP registration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(response(dnsAnswer))
    );

    renderPage({ initialQuery: "Example.COM.", initialType: "A" });

    await screen.findByText("Cloudflare 1.1.1.1");
    expect(
      screen
        .getByRole("link", { name: "View RDAP registration for example.com" })
        .getAttribute("href")
    ).toBe("/domain/example.com");
  });

  it("does not offer a domain registration link for an IP lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(response(dnsAnswer))
    );

    renderPage({ initialQuery: "192.0.2.5", initialType: "PTR" });

    await screen.findByText("Cloudflare 1.1.1.1");
    expect(
      screen.queryByRole("link", { name: /RDAP registration/u })
    ).toBeNull();
  });

  it("shows a distinct NXDOMAIN empty answer", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        ...dnsAnswer,
        status: 3,
        records: [],
        dnssecAuthenticated: false,
      })
    );

    vi.stubGlobal("fetch", fetchMock);
    renderPage({ initialQuery: "missing.example", initialType: "AAAA" });

    await screen.findByText("Name not found");
    expect(screen.getByText(/Name does not exist \(NXDOMAIN\)/u)).toBeTruthy();
    expect(
      screen.getByText("The resolver reports that this name does not exist.")
    ).toBeTruthy();
    expect(
      screen.getByText("DNSSEC: not authenticated by the resolver")
    ).toBeTruthy();
  });

  it.each(dnsRecordCases)(
    "formats $recordType resource data",
    async ({ answer, record, recordType }) => {
      const body = Schema.decodeUnknownSync(DnsLookupResponseSchema)({
        ...dnsAnswer,
        recordType,
        records: [record],
      });

      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(response(body))
      );
      renderPage({ initialQuery: "example.com", initialType: recordType });

      await expect(screen.findByText(answer)).resolves.toBeTruthy();
    }
  );

  it("shows safe API errors and allows retry", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(
          {
            error: {
              code: "invalid-input",
              message: "Choose PTR for an address.",
            },
          },
          400
        )
      )
      .mockResolvedValueOnce(response(dnsAnswer));

    vi.stubGlobal("fetch", fetchMock);
    renderPage({ initialQuery: "192.0.2.5", initialType: "A" });

    await screen.findByRole("alert");
    expect(screen.getByText("Choose PTR for an address.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("192.0.2.5", { selector: "dd" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed success payloads and reports transport failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ records: [] }))
      .mockRejectedValueOnce(new Error("private transport detail"));

    vi.stubGlobal("fetch", fetchMock);

    const { rerenderPage } = renderPage({
      initialQuery: "example.com",
      initialType: "TXT",
    });

    await screen.findByText(
      "The DNS service returned data in an unexpected format."
    );
    rerenderPage({ initialQuery: "example.net", initialType: "TXT" });
    await screen.findByText(
      "The DNS lookup could not reach the service. Try again."
    );
    expect(screen.queryByText("private transport detail")).toBeNull();
  });
});
