import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const deployedAt = new Date();
const buildId = deployedAt.toISOString().replace(/[-:.TZ]/g, "");
const deployedAtDisplay = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Manila",
}).format(deployedAt);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "app-version-file",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify(
            {
              buildId,
              deployedAt: deployedAt.toISOString(),
              deployedAtDisplay,
            },
            null,
            2
          ),
        });
      },
    },
  ],
  define: {
    "import.meta.env.VITE_APP_BUILD_ID": JSON.stringify(buildId),
    "import.meta.env.VITE_APP_DEPLOYED_AT": JSON.stringify(deployedAt.toISOString()),
    "import.meta.env.VITE_APP_DEPLOYED_AT_DISPLAY": JSON.stringify(deployedAtDisplay),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${buildId}-[hash].js`,
        chunkFileNames: `assets/[name]-${buildId}-[hash].js`,
        assetFileNames: `assets/[name]-${buildId}-[hash][extname]`,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
