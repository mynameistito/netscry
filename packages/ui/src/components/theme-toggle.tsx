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
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
      }}
      type="button"
    >
      {isDark ? "Dark theme" : "Light theme"}
    </button>
  );
};
