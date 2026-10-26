// oxlint-disable jsx-a11y/prefer-tag-over-role -- React 19 does not recognize the HTML search landmark element.
import { ThemeToggle } from "@netscry/ui/components/theme-toggle";
import {
  Activity,
  CircleHelp,
  Globe2,
  House,
  Menu,
  Search,
  X,
  ArrowRight,
} from "@netscry/ui/lib/icons";
import type { ReactNode } from "react";
import { useState } from "react";

const navigation = [
  { href: "#overview", label: "Overview", icon: House },
  { href: "#lookups", label: "Public lookups", icon: Globe2 },
  { href: "#diagnostics", label: "Diagnostics", icon: Activity },
];

interface AppShellProps {
  children: ReactNode;
}

/**
 * Provides responsive product navigation and a framed work area.
 * @returns The shared NetScry app frame.
 */
export const AppShell = ({ children }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  return (
    <div className="bg-muted/70 text-foreground min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1800px]">
        <aside
          aria-label="Product sidebar"
          className={`${menuOpen ? "flex" : "hidden"} bg-muted/70 fixed inset-y-0 left-0 z-30 w-64 flex-col px-4 py-5 md:static md:flex md:w-[228px] md:shrink-0 md:px-4`}
        >
          <a
            className="flex h-10 items-center gap-2 px-2 font-semibold tracking-tight"
            href="#overview"
          >
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <Activity aria-hidden="true" size={16} />
            </span>
            NetScry
          </a>

          <div className="text-muted-foreground mt-8 px-2 font-mono text-xs tracking-wide uppercase">
            Workspace
          </div>
          <nav aria-label="Main navigation" className="mt-2 space-y-1">
            {navigation.map(({ href, label, icon: Icon }) => (
              <a
                className="text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-ring flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-2"
                href={href}
                key={href}
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
                {label}
              </a>
            ))}
          </nav>

          <div className="border-border/70 mt-auto space-y-1 border-t pt-4">
            <a
              className="text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-ring flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-2"
              href="#about"
            >
              <CircleHelp aria-hidden="true" size={16} strokeWidth={1.8} />
              Privacy & sources
            </a>
          </div>
        </aside>

        {menuOpen ? (
          <button
            aria-label="Close navigation"
            className="bg-foreground/20 fixed inset-0 z-20 cursor-default md:hidden"
            onClick={() => {
              setMenuOpen(false);
            }}
            type="button"
          />
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col md:py-2 md:pr-2">
          <header className="flex h-12 shrink-0 items-center gap-3 px-4 md:px-5">
            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              className="text-muted-foreground hover:bg-background focus-visible:outline-ring inline-flex size-9 items-center justify-center rounded-md focus-visible:outline-2 md:hidden"
              onClick={() => {
                setMenuOpen(!menuOpen);
              }}
              type="button"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <form
              role="search"
              className="border-input bg-background focus-within:border-ring focus-within:ring-ring/20 mx-auto flex h-8 w-full max-w-xl items-center gap-2 rounded-md border px-2.5 focus-within:ring-2"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchMessage(
                  query.trim()
                    ? `Public lookup for “${query.trim()}” is not available yet.`
                    : "Enter an IP address, ASN, or domain to search."
                );
              }}
            >
              <Search
                aria-hidden="true"
                className="text-muted-foreground shrink-0"
                size={15}
              />
              <input
                aria-describedby="lookup-search-status"
                aria-label="Search IP address, ASN, or domain"
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none"
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                }}
                placeholder="Search IP, ASN, or domain…"
                type="search"
                value={query}
              />
              <button
                aria-label="Search"
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring inline-flex size-6 shrink-0 items-center justify-center rounded focus-visible:outline-2"
                type="submit"
              >
                <ArrowRight aria-hidden="true" size={14} />
              </button>
            </form>
            <div className="shrink-0 items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          <div className="border-border bg-background flex-1 rounded-t-xl border md:rounded-xl">
            <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-8 lg:py-9">
              <p
                aria-live="polite"
                className="sr-only"
                id="lookup-search-status"
              >
                {searchMessage}
              </p>
              {searchMessage ? (
                <div className="border-border bg-muted/50 text-muted-foreground mb-5 flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm">
                  <span>{searchMessage}</span>
                  <button
                    aria-label="Dismiss search message"
                    className="hover:bg-muted rounded p-1"
                    onClick={() => {
                      setSearchMessage("");
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </div>
              ) : null}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
