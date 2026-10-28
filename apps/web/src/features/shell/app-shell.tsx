import { Button } from "@netscry/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@netscry/ui/components/input-group";
import { ThemeToggle } from "@netscry/ui/components/theme-toggle";
import { Activity, ArrowRight, Menu, Search, X } from "@netscry/ui/lib/icons";
import { Link } from "@tanstack/react-router";
import type { ComponentType, MouseEventHandler, ReactNode } from "react";
import { useState } from "react";

type NavigationTarget = "/" | "/lookups" | "/sources" | "/privacy" | "/terms";

/** Properties for the product's route-aware navigation links. */
export interface AppShellLinkProps {
  to: NavigationTarget;
  hash?: string;
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

/**
 * Renders a product navigation target through TanStack Router.
 *
 * @returns The client-side route link.
 */
const RouterLink = ({ to, hash, ...props }: AppShellLinkProps) => (
  <Link hash={hash} to={to} {...props} />
);

const navigation: readonly {
  href: NavigationTarget;
  hash?: string;
  label: string;
}[] = [
  { href: "/", label: "Overview" },
  { href: "/lookups", label: "Public lookups" },
  { href: "/", hash: "location-map", label: "Location" },
  { href: "/sources", label: "Sources" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

interface AppShellProps {
  children: ReactNode;
  LinkComponent?: ComponentType<AppShellLinkProps>;
}

/**
 * Provides responsive product navigation and a readable lookup workspace.
 * @returns The shared NetScry frame around a page.
 */
export const AppShell = ({
  children,
  LinkComponent = RouterLink,
}: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-t-primary bg-card relative z-10 border-t-4">
        <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center gap-7 px-6 max-[1050px]:gap-4.5 max-[820px]:min-h-0 max-[820px]:max-w-2xl max-[820px]:flex-wrap max-[820px]:gap-3 max-[820px]:px-4 max-[820px]:py-3.25">
          <a
            className="text-foreground inline-flex flex-none items-center gap-2.25 text-xl font-semibold tracking-tighter no-underline max-[820px]:mr-auto"
            href="/"
            aria-label="NetScry home"
          >
            <span className="border-primary text-primary inline-flex size-8 items-center justify-center rounded-full border-2">
              <Activity aria-hidden="true" size={19} strokeWidth={2.3} />
            </span>
            <span>NetScry</span>
          </a>

          <search className="w-full max-w-96 flex-[1_1_320px] max-[1050px]:max-w-80 max-[820px]:order-2 max-[820px]:max-w-none max-[820px]:basis-full">
            <form action="/lookup" method="get">
              <InputGroup size="lg">
                <InputGroupAddon align="inline-start">
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Search an IP, ASN, or domain"
                  name="query"
                  placeholder="Search IPs, ASNs, or domains"
                  type="search"
                />
                <input name="type" type="hidden" value="A" />
                <InputGroupButton aria-label="Search" type="submit">
                  <ArrowRight aria-hidden="true" data-icon="inline-end" />
                </InputGroupButton>
              </InputGroup>
            </form>
          </search>

          <nav
            aria-label="Main navigation"
            className="flex flex-1 items-center justify-end gap-7 max-[1050px]:gap-3.5 max-[820px]:hidden"
          >
            {navigation.map(({ href, hash, label }) => (
              <LinkComponent
                className="text-foreground hover:text-primary text-sm font-medium no-underline"
                to={href}
                hash={hash}
                key={href}
              >
                {label}
              </LinkComponent>
            ))}
          </nav>

          <div className="order-1 inline-flex items-center gap-2">
            <ThemeToggle />
            <Button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              className="hidden max-[820px]:inline-flex"
              onClick={() => {
                setMenuOpen(!menuOpen);
              }}
              size="icon-xl"
              type="button"
              variant="outline"
            >
              {menuOpen ? (
                <X aria-hidden="true" data-icon="inline-start" />
              ) : (
                <Menu aria-hidden="true" data-icon="inline-start" />
              )}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            aria-label="Mobile navigation"
            className="border-border mx-auto mb-3.5 grid w-full max-w-xl gap-1 border-t px-4 py-2 min-[821px]:hidden"
          >
            {navigation.map(({ href, hash, label }) => (
              <LinkComponent
                className="text-foreground hover:text-primary px-1 py-2.25 text-sm font-medium no-underline"
                to={href}
                hash={hash}
                key={href}
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                {label}
              </LinkComponent>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="border-border bg-card mx-auto mt-2 w-full max-w-screen-2xl rounded-t-xl border max-[820px]:mt-0 max-[820px]:rounded-none max-[820px]:border-x-0 max-[820px]:border-b-0">
        <div className="[&_.border-b]:border-border [&_section[class*='rounded'][class*='border']]:bg-card [&_.text-xs]:text-caption mx-auto w-full max-w-screen-xl px-9.5 pt-9 pb-7.5 max-[820px]:px-5.5 max-[820px]:pt-6.5 max-[820px]:pb-7 max-[480px]:px-4.25 max-[480px]:pt-6 [&_.text-xs]:leading-5 [&_a.text-primary]:font-medium [&_dd.text-sm]:text-base [&_dd.text-sm]:leading-6 [&_dt.text-sm]:text-sm [&_dt.text-sm]:leading-5 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h1]:tracking-tighter sm:[&_h1]:text-4xl [&_h3]:text-base [&_h3]:leading-6 [&_h3]:font-semibold [&_p.text-sm]:text-sm [&_p.text-sm]:leading-5">
          {children}
        </div>
      </div>
      <footer className="text-muted-foreground mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-9.5 py-6 text-sm max-[820px]:px-5.5 max-[480px]:px-4.25">
        <span>NetScry · Network visibility</span>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-2"
        >
          <LinkComponent className="hover:text-foreground" to="/lookups">
            Public lookups
          </LinkComponent>
          <LinkComponent className="hover:text-foreground" to="/sources">
            Sources
          </LinkComponent>
          <LinkComponent className="hover:text-foreground" to="/privacy">
            Privacy
          </LinkComponent>
          <LinkComponent className="hover:text-foreground" to="/terms">
            Terms
          </LinkComponent>
        </nav>
      </footer>
    </div>
  );
};
