import { createServer } from "node:http";

import { loadConfig } from "./config";
import { handleRest, writeError, writeJson } from "./http";
import { handleMcpRequest } from "./mcp";
import { openApiSpec } from "./openapi";
import { RevparmaxApiService } from "./service";

const config = loadConfig();
const service = new RevparmaxApiService(config.convexUrl);
const baseUrl = `http://${config.host}:${config.port}`;

const isAuthorized = (authorization: string | undefined): boolean => {
  if (!config.token) {
    return true;
  }
  return authorization === `Bearer ${config.token}`;
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", baseUrl);

  if (url.pathname === "/health" && request.method === "GET") {
    writeJson(response, 200, {
      api: "revparmax-api",
      convexUrl: config.convexUrl,
      mcp: "/mcp",
      ok: true,
      openapi: "/openapi.json",
    });
    return;
  }

  if (url.pathname === "/openapi.json" && request.method === "GET") {
    writeJson(response, 200, openApiSpec);
    return;
  }

  if (!isAuthorized(request.headers.authorization)) {
    writeError(response, 401, "Unauthorized");
    return;
  }

  if (url.pathname === "/mcp") {
    await handleMcpRequest(request, response, service);
    return;
  }

  const handled = await handleRest({ baseUrl, request, response, service });
  if (!handled) {
    writeError(response, 404, "Not found");
  }
});

server.listen(config.port, config.host, () => {
  console.log(
    `RevParMax API listening on ${baseUrl} and reading Convex at ${config.convexUrl}`
  );
});
