import { ThemeToggle } from "@netscry/ui/components/theme-toggle";
import {
  Activity,
  ArrowRight,
  Menu,
  Search,
  X,
} from "@netscry/ui/lib/icons";
import type { ReactNode } from "react";
import { useState } from "react";

const navigation = [
  { href: "/", label: "Overview" },
  { href: "/#lookups", label: "Public lookups" },
  { href: "/#location-map", label: "Location" },
  { href: "/#about", label: "Privacy & sources" },
];

interface AppShellProps {
  children: ReactNode;
}

/**
 * Provides responsive product navigation and a readable lookup workspace.
 * @returns The shared NetScry frame around a page.
 */
export const AppShell = ({ children }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-frame min-h-screen">
      <header className="site-header">
        <div className="site-header-inner">
          <a className="site-brand" href="/" aria-label="NetScry home">
            <span className="site-brand-mark">
              <Activity aria-hidden="true" size={19} strokeWidth={2.3} />
            </span>
            <span>NetScry</span>
          </a>

          <form
            role="search"
            className="site-search"
            action="/lookup"
            method="get"
          >
            <Search aria-hidden="true" className="site-search-icon" size={17} />
            <input
              aria-label="Search an IP, ASN, or domain"
              name="query"
              placeholder="Search IPs, ASNs, or domains"
              type="search"
            />
            <input name="type" type="hidden" value="A" />
            <button aria-label="Search" type="submit">
              <ArrowRight aria-hidden="true" size={16} />
            </button>
          </form>

          <nav aria-label="Main navigation" className="site-nav">
            {navigation.map(({ href, label }) => (
              <a href={href} key={href}>
                {label}
              </a>
            ))}
          </nav>

          <div className="site-actions">
            <ThemeToggle />
            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              className="site-menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav aria-label="Mobile navigation" className="site-mobile-nav">
            {navigation.map(({ href, label }) => (
              <a href={href} key={href} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="site-sheet">
        <div className="site-content">{children}</div>
      </div>
    </div>
  );
};
