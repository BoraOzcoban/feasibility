import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/tcmb-rates": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tcmb-rates/, ""),
        target: "https://www.tcmb.gov.tr",
      },
    },
  },
});
