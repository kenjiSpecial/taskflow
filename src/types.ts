export interface AppEnv {
  Bindings: {
    DB: D1Database;
    REALTIME_HUB: DurableObjectNamespace;
    API_TOKEN: string;
    ENVIRONMENT: string;
  };
}
