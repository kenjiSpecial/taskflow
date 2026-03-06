import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            API_TOKEN: "test-token",
          },
          d1Databases: {
            DB: "todo-test-db",
          },
          durableObjects: {
            REALTIME_HUB: "RealtimeHub",
          },
        },
      },
    },
  },
});
