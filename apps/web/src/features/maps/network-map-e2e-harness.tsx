import { createRoot } from "react-dom/client";

import { NetworkMap } from "./network-map";

/** Mount deterministic map coordinates into the running Vite app for browser coverage. */
export const mountNetworkMapE2eHarness = () => {
  const body = document.querySelector("body");

  if (body === null) {
    throw new Error("The map browser harness requires a document body.");
  }

  body.insertAdjacentHTML(
    "beforeend",
    '<div data-testid="map-interaction-harness"></div>'
  );

  const mountPoint = document.querySelector(
    '[data-testid="map-interaction-harness"]'
  );

  if (mountPoint === null) {
    throw new Error(
      "The map browser harness could not create its mount point."
    );
  }

  createRoot(mountPoint).render(
    <NetworkMap
      location={{
        label: "AKL · Auckland International Airport (airport reference)",
        latitude: -37.01199,
        longitude: 174.786331,
      }}
      mapLabel="Browser test location map"
      screenReaderDescription="This marker is the approximate airport reference, not a Cloudflare data center."
    />
  );
};
