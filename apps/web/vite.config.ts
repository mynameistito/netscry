import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    ...(process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1"
      ? []
      : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
  resolve: { tsconfigPaths: true },
});
