import { defineConfig } from "blume";

export default defineConfig({
  title: "NetScry",
  description:
    "Guides and references for NetScry's network diagnostics and public lookups.",
  content: {
    root: "content",
  },
  theme: {
    accent: "teal",
    mode: "system",
    toggle: true,
    fonts: {
      body: "ibm-plex-sans",
      display: "ibm-plex-sans",
      mono: "ibm-plex-mono",
    },
  },
});
