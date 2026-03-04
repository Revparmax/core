import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_CONVEX_SITE_URL: z.url(),
  },
  // biome-ignore lint/suspicious/noExplicitAny: t3-oss/env-core requires Vite's import.meta.env at runtime
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
