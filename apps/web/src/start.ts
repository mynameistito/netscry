import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import {
  removeResponseHeader,
  setResponseHeaders,
} from "@tanstack/react-start/server";

import { cspNonceHeader, getSecurityHeaders } from "./server/security-headers";

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === "serverFn",
});

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const nonce = crypto.randomUUID();

    setResponseHeaders(getSecurityHeaders(request, nonce));

    try {
      return await next();
    } finally {
      removeResponseHeader(cspNonceHeader);
    }
  }
);

/** Install request-scoped security headers and retain Start's CSRF checks. */
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, securityHeadersMiddleware],
}));
