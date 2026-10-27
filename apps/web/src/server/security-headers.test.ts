import { describe, expect, it } from "vitest";

import { getSecurityHeaders } from "./security-headers";

describe(getSecurityHeaders, () => {
  it("adds a nonce CSP and privacy headers to HTTPS app responses", () => {
    const headers = getSecurityHeaders(
      new Request("https://netscry.example/"),
      "request-nonce"
    );

    const responseHeaders = Object.fromEntries(headers);

    expect(responseHeaders).toMatchObject({
      "cache-control": "no-store",
      "permissions-policy":
        "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      "referrer-policy": "no-referrer",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });

    expect(responseHeaders["content-security-policy"]).toContain(
      "script-src 'self' 'nonce-request-nonce'"
    );
    expect(responseHeaders["content-security-policy"]).toContain(
      "connect-src 'self' https://tiles.openfreemap.org https://stats.g.doubleclick.net https://www.google.com"
    );
  });

  it("keeps API policy restrictive without replacing route cache headers", () => {
    const headers = getSecurityHeaders(
      new Request("http://netscry.example/api/v1/ip/203.0.113.7"),
      "request-nonce"
    );

    const responseHeaders = Object.fromEntries(headers);

    expect(responseHeaders).toMatchObject({
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
    expect(headers.get("cache-control")).toBeNull();
    expect(headers.get("strict-transport-security")).toBeNull();
  });
});
