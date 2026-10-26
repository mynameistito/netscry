import { ThemeToggle } from "@netscry/ui/components/theme-toggle";
import { createFileRoute } from "@tanstack/react-router";

const HomePage = () => (
  <main>
    <p>Network diagnostics</p>
    <h1>See what your network sees.</h1>
    <ThemeToggle />
    <p>
      NetScry brings your connection details and public network records into one
      clear, privacy-forward workspace.
    </p>
  </main>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
