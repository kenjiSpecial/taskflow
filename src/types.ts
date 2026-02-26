export interface AppEnv {
  Bindings: {
    DB: D1Database;
    API_TOKEN: string;
    ENVIRONMENT: string;
  };
}
