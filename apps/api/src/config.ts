const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8788;

export interface ApiConfig {
  convexUrl: string;
  host: string;
  port: number;
  token?: string;
}

export const loadConfig = (): ApiConfig => ({
  convexUrl: process.env.CONVEX_URL ?? DEFAULT_CONVEX_URL,
  host: process.env.REVPARMAX_API_HOST ?? DEFAULT_HOST,
  port: Number(process.env.REVPARMAX_API_PORT ?? DEFAULT_PORT),
  token: process.env.REVPARMAX_API_TOKEN,
});
