export interface BridgeConfig {
  convexUrl: string;
  host: string;
  port: number;
  token?: string;
}

const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;

export const loadConfig = (): BridgeConfig => ({
  convexUrl: process.env.CONVEX_URL ?? DEFAULT_CONVEX_URL,
  host: process.env.HOST ?? DEFAULT_HOST,
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  token: process.env.LEGACY_API_TOKEN,
});
