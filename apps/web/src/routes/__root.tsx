import { ThemeProvider } from "@netscry/ui/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { useMemo } from "react";

import appCss from "~/styles/app.css?url";

const RootDocument = () => {
  const queryClient = useMemo(() => new QueryClient(), []);
  const router = useRouter();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <ThemeProvider nonce={router.options.ssr?.nonce}>
          <QueryClientProvider client={queryClient}>
            <Outlet />
          </QueryClientProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
};

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
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  component: RootDocument,
});
