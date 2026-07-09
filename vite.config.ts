// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact, tailwindcss, etc.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        strategies: "generateSW",
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false, // served from public/manifest.webmanifest
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-nav",
                networkTimeoutSeconds: 4,
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2|png|svg|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
