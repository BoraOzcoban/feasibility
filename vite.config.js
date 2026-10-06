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
      output: {
        // Libraries change less often than the app, so they get their own
        // files and stay cached across releases.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return "react";
          if (/node_modules\/(@supabase|iceberg-js)\//.test(id)) return "supabase";
          return undefined;
        },
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
