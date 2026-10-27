import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getResponseHeader } from "@tanstack/react-start/server";

import { routeTree } from "./routeTree.gen";

const getCspNonce = createIsomorphicFn()
  .client(() => "")
  .server(() => getResponseHeader("x-netscry-csp-nonce"));

/**
 * Creates the request-local TanStack Router instance.
 * @returns A fresh router for the current request.
 */
export const getRouter = () =>
  createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    ssr: { nonce: getCspNonce() },
  });
