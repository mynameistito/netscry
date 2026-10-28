// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VisitorOverview } from "./visitor-overview";

const fetchMock = vi.fn<typeof fetch>();

const available = <Value,>(value: Value, units?: string) => ({
  _tag: "Available" as const,
  source: "cloudflare-request" as const,
  value,
  sensitivity: "public" as const,
  units,
});

const unavailable = {
  _tag: "Unavailable" as const,
  source: "local-runtime" as const,
  reason: "not-provided" as const,
  sensitivity: "public" as const,
};

const visitorData = () => ({
  network: {
    ip: available({ address: "2001:db8::1", version: 6 as const }),
    asn: available(64_512),
    asOrganization: available("Example Network"),
  },
  location: {
    continent: available("Oceania"),
    country: available("NZ"),
    region: available("Auckland"),
    regionCode: available("AUK"),
    city: available("Auckland"),
    postalCode: unavailable,
    latitude: available(-36.85, "degrees"),
    longitude: available(174.76, "degrees"),
    timezone: available("Pacific/Auckland"),
    metroCode: unavailable,
    isEuCountry: available(false),
  },
  edge: {
    colo: available("AKL"),
    rayId: available("abc123-AKL"),
  },
  connection: {
    httpProtocol: available("HTTP/2"),
    tlsVersion: available("TLSv1.3"),
    tlsCipher: unavailable,
    originalAcceptedEncoding: available("gzip, br"),
    tcpRttMs: available(18, "ms"),
    quicRttMs: unavailable,
    estimatedTcpDeliveryRateBps: unavailable,
  },
  security: {
    ja3: unavailable,
    ja4: unavailable,
    botScore: unavailable,
    verifiedBot: available(false),
    mutualTls: unavailable,
  },
});

const readyState = () => ({
  status: "ready" as const,
  data: visitorData(),
  raw: {
    status: "ready" as const,
    data: {
      colo: available("AKL"),
      "cf-connecting-ip": {
        _tag: "Available" as const,
        source: "cloudflare-request" as const,
        value: "2001:db8::1",
        sensitivity: "personal" as const,
      },
      botManagement: {
        _tag: "Unavailable" as const,
        source: "cloudflare-request" as const,
        reason: "redacted" as const,
        sensitivity: "sensitive" as const,
      },
    },
  },
});

const renderVisitorOverview = (
  state: Parameters<typeof VisitorOverview>[0]["state"]
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <VisitorOverview state={state} />
    </QueryClientProvider>
  );
};

describe(VisitorOverview, () => {
  beforeEach(() => {
    fetchMock.mockReset().mockRejectedValue(new Error("No alternate route"));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading state while the route reads request metadata", () => {
    renderVisitorOverview({ status: "loading" });

    expect(screen.getByText("Reading metadata for this request…")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Refresh request" }).getAttribute("href")
    ).toBe("/");
  });

  it("renders each requested visitor panel and labels its source and missing fields", () => {
    renderVisitorOverview(readyState());

    const overview =
      screen.getByRole("region", { name: "Visitor connection" }).textContent ??
      "";

    expect(overview).toContain("2001:db8::1");
    expect(overview).toContain("Example Network");
    expect(overview).toContain("Approximate location");
    expect(overview).toContain("Security signals");
    expect(overview).toContain("Not provided by this request");
  });

  it("checks the IPv4-only endpoint when the visitor request uses IPv6", async () => {
    fetchMock.mockResolvedValue(Response.json({ ip: "198.51.100.24" }));

    renderVisitorOverview(readyState());

    await screen.findByText("198.51.100.24 · IPv4");

    expect(screen.getByText("Visitor IPv4")).toBeTruthy();
    expect(screen.getByText(/ipify\.org/u)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.ipify.org?format=json",
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      })
    );
  });

  it("shows the alternate family when the visitor has no route for it", async () => {
    renderVisitorOverview(readyState());

    await screen.findByText("Source could not be reached");

    expect(screen.getByText("Visitor IPv4")).toBeTruthy();
    expect(screen.getByText(/ipify\.org/u)).toBeTruthy();
  });

  it("marks a stalled alternate address lookup unavailable after its timeout", async () => {
    const timeoutController = new AbortController();

    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);

    const response = Promise.withResolvers<Response>();

    fetchMock.mockReturnValue(response.promise);

    renderVisitorOverview(readyState());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.ipify.org?format=json",
        expect.anything()
      );
    });

    expect(timeoutSpy).toHaveBeenCalledWith(5000);

    timeoutController.abort(new DOMException("Timed out", "TimeoutError"));

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBeTruthy();
    response.reject(new DOMException("Timed out", "TimeoutError"));

    await screen.findByText("Source could not be reached");
  });

  it("checks the IPv6-only endpoint when the visitor request uses IPv4", async () => {
    fetchMock.mockResolvedValue(Response.json({ ip: "2001:db8::2" }));

    const state = readyState();

    const ipv4State = {
      ...state,
      data: {
        ...state.data,
        network: {
          ...state.data.network,
          ip: available({ address: "198.51.100.25", version: 4 as const }),
        },
      },
    };

    renderVisitorOverview(ipv4State);

    await screen.findByText("2001:db8::2 · IPv6");

    expect(screen.getByText("Visitor IPv6")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api6.ipify.org?format=json",
      expect.objectContaining({ credentials: "omit" })
    );
  });

  it("copies available identity values and confirms the result accessibly", async () => {
    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderVisitorOverview(readyState());

    fireEvent.click(screen.getByRole("button", { name: "Copy visitor IP" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("2001:db8::1");
      expect(screen.getByText("Copied")).toBeTruthy();
    });
  });

  it("shows the safe raw representation, redactions, copy, and download actions", async () => {
    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderVisitorOverview(readyState());

    fireEvent.click(
      screen.getByText("Safe raw Cloudflare metadata", { selector: "summary" })
    );

    expect(
      screen.getByText(/sensitive security material is redacted/u)
    ).toBeTruthy();
    expect(screen.getByText(/botManagement/u)).toBeTruthy();
    const download = screen.getByRole("link", { name: "Download JSON" });
    expect(download.getAttribute("href")).toBe("/api/v1/me/raw");
    expect(download.getAttribute("download")).toBe("netscry-raw-metadata.json");

    fireEvent.click(screen.getByRole("button", { name: "Copy raw JSON" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify(readyState().raw.data, null, 2)
      );
    });
  });

  it("keeps the visitor panels available when raw metadata is unavailable", () => {
    const state = readyState();

    renderVisitorOverview({ ...state, raw: { status: "error" } });

    expect(screen.getByText("Example Network")).toBeTruthy();
    fireEvent.click(
      screen.getByText("Safe raw Cloudflare metadata", { selector: "summary" })
    );
    expect(
      screen.getByText("Safe raw metadata is unavailable for this request.")
    ).toBeTruthy();
  });

  it("shows an unavailable state and retries when the visitor read fails", async () => {
    renderVisitorOverview({ status: "error" });

    await expect(screen.findByRole("alert")).resolves.toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Try again" }).getAttribute("href")
    ).toBe("/");
  });
});
