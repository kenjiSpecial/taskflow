export interface AppEnv {
  Bindings: {
    DB: D1Database;
    REALTIME_HUB: DurableObjectNamespace;
    API_TOKEN: string;
    ENVIRONMENT: string;
    REALTIME_INTERNAL_SECRET: string;
  };
}
