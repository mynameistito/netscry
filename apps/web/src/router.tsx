import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

/**
 * Creates the request-local TanStack Router instance.
 * @returns A fresh router for the current request.
 */
export const getRouter = () =>
  createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
