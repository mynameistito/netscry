// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

const renderToggle = () =>
  render(
    <ThemeProvider defaultTheme="light" enableSystem={false}>
      <ThemeToggle />
    </ThemeProvider>
  );

describe(ThemeToggle, () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    window.matchMedia = (media) => ({
      matches: false,
      media,
      onchange: null,
      // oxlint-disable-next-line typescript/no-deprecated -- jsdom needs the legacy API consumed by next-themes.
      addListener: () => {},
      // oxlint-disable-next-line typescript/no-deprecated -- jsdom needs the legacy API consumed by next-themes.
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the light theme state and switches to dark mode when activated", async () => {
    renderToggle();

    const toggle = screen.getByRole("button", { name: "Toggle dark mode" });
    await waitFor(() => {
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("shows the dark theme state and switches to light mode when activated", async () => {
    localStorage.setItem("theme", "dark");
    renderToggle();

    const toggle = screen.getByRole("button", { name: "Toggle dark mode" });
    await waitFor(() => {
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
    });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    });
  });
});
