import type { ErrorHandler } from "hono";
import type { AppEnv } from "../types";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  console.error(err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    500,
  );
};
