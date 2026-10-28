import { Button } from "@netscry/ui/components/button";
import { Moon, Sun } from "@netscry/ui/lib/icons";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// eslint-disable-next-line no-empty-function -- The client/server snapshot difference is one-time; there is no external store to subscribe to.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Renders an accessible control for switching between light and dark themes.
 * @returns A button exposing the selected theme through `aria-pressed`.
 */
export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();

  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      aria-label="Toggle dark mode"
      aria-pressed={isDark}
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
      }}
      size="icon-lg"
      type="button"
      variant="ghost"
    >
      {isDark ? (
        <Moon aria-hidden="true" data-icon="inline-start" />
      ) : (
        <Sun aria-hidden="true" data-icon="inline-start" />
      )}
      <span className="sr-only">{isDark ? "Dark theme" : "Light theme"}</span>
    </Button>
  );
};
