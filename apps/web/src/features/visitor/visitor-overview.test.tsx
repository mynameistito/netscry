// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VisitorOverview } from "./visitor-overview";

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

describe(VisitorOverview, () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a loading state while the route reads request metadata", () => {
    render(<VisitorOverview state={{ status: "loading" }} />);

    expect(screen.getByText("Reading metadata for this request…")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Refresh request" }).getAttribute("href")
    ).toBe("/");
  });

  it("renders each requested visitor panel and labels its source and missing fields", () => {
    render(<VisitorOverview state={readyState()} />);

    const overview =
      screen.getByRole("region", { name: "Visitor connection" }).textContent ??
      "";

    expect(overview).toContain("2001:db8::1");
    expect(overview).toContain("Example Network");
    expect(overview).toContain("Approximate location");
    expect(overview).toContain("Security signals");
    expect(overview).toContain("Not provided by this request");
  });

  it("copies available identity values and confirms the result accessibly", async () => {
    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<VisitorOverview state={readyState()} />);

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
    render(<VisitorOverview state={readyState()} />);

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

    render(<VisitorOverview state={{ ...state, raw: { status: "error" } }} />);

    expect(screen.getByText("Example Network")).toBeTruthy();
    fireEvent.click(
      screen.getByText("Safe raw Cloudflare metadata", { selector: "summary" })
    );
    expect(
      screen.getByText("Safe raw metadata is unavailable for this request.")
    ).toBeTruthy();
  });

  it("shows an unavailable state and retries when the visitor read fails", async () => {
    render(<VisitorOverview state={{ status: "error" }} />);

    await expect(screen.findByRole("alert")).resolves.toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Try again" }).getAttribute("href")
    ).toBe("/");
  });
});
