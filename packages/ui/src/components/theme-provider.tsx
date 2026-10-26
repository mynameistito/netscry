import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Provides system-aware theme state to the application.
 * @param props - Provider options forwarded to next-themes.
 * @returns The configured next-themes provider.
 */
export const ThemeProvider = (
  props: ComponentProps<typeof NextThemesProvider>
) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
    {...props}
  />
);
