import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";

import appCss from "~/styles/app.css?url";

const RootDocument = () => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      <Outlet />
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NetScry — Network diagnostics" },
      {
        name: "description",
        content: "Inspect your connection, IP address, and network path.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});
