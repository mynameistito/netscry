const CSP_NONCE_HEADER = "x-netscry-csp-nonce";

/** Build response security headers for the SSR app and JSON API surface.
 * @param request - Current app request, used to apply HSTS only over HTTPS.
 * @param nonce - Request-scoped nonce for TanStack Start's hydration scripts.
 * @returns Headers to add to the response.
 */
export const getSecurityHeaders = (request: Request, nonce: string) => {
  const { pathname } = new URL(request.url);

  const isApiRequest =
    pathname === "/api/v1" || pathname.startsWith("/api/v1/");

  const contentSecurityPolicy = isApiRequest
    ? "default-src 'none'; frame-ancestors 'none'"
    : [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        `style-src-elem 'self' 'nonce-${nonce}'`,
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob: https://tiles.openfreemap.org",
        "font-src 'self' data: https://tiles.openfreemap.org",
        "connect-src 'self' https://tiles.openfreemap.org https://stats.g.doubleclick.net https://www.google.com https://api.ipify.org https://api6.ipify.org",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "upgrade-insecure-requests",
      ].join("; ");

  const headers = new Headers({
    "Content-Security-Policy": contentSecurityPolicy,
    "Permissions-Policy":
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    [CSP_NONCE_HEADER]: nonce,
  });

  if (isApiRequest) {
    return headers;
  }

  headers.set("Cache-Control", "no-store");

  if (request.url.startsWith("https://")) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  return headers;
};

/** The internal nonce header is consumed by the request-local router only. */
export const cspNonceHeader = CSP_NONCE_HEADER;
