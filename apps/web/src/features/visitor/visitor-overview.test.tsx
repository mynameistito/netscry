// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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

  it("shows an unavailable state and retries when the visitor read fails", async () => {
    render(<VisitorOverview state={{ status: "error" }} />);

    await expect(screen.findByRole("alert")).resolves.toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Try again" }).getAttribute("href")
    ).toBe("/");
  });
});
