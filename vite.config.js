import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      // react-router marks its modules "use client" for server components;
      // this app renders only in the browser, so the directive is moot.
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
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
