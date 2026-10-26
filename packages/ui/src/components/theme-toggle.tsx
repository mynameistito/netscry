import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Renders an accessible control for switching between light and dark themes.
 * @returns A button exposing the selected theme through `aria-pressed`.
 */
export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label="Toggle dark mode"
      aria-pressed={isDark}
      className="border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring inline-flex size-9 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
      }}
      type="button"
    >
      {isDark ? (
        <Moon aria-hidden="true" size={16} />
      ) : (
        <Sun aria-hidden="true" size={16} />
      )}
      <span className="sr-only">{isDark ? "Dark theme" : "Light theme"}</span>
    </button>
  );
};
