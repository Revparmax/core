import type { IncomingMessage, ServerResponse } from "node:http";

import type { LegacyBridgeService } from "./service";

export interface HttpContext {
  baseUrl: string;
  request: IncomingMessage;
  response: ServerResponse;
  service: LegacyBridgeService;
}

type RouteHandler = (
  context: HttpContext,
  match: RegExpMatchArray
) => Promise<void>;

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown
) => {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(payload, null, 2));
};

const sendError = (
  response: ServerResponse,
  statusCode: number,
  message: string
) => {
  sendJson(response, statusCode, { error: { message } });
};

const numberParam = (value: string, name: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
};

const optionalNumber = (value: string | null): number | undefined => {
  if (value === null || value.length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const optionalString = (value: string | null): string | undefined =>
  value === null || value.length === 0 ? undefined : value;

const routes: Array<{ handler: RouteHandler; pattern: RegExp }> = [
  {
    pattern: /^\/companies$/,
    handler: async ({ response, service }) => {
      sendJson(response, 200, await service.listCompanies());
    },
  },
  {
    pattern: /^\/companies\/(\d+)\/properties$/,
    handler: async ({ response, service }, match) => {
      sendJson(
        response,
        200,
        await service.listProperties(numberParam(match[1] ?? "", "companyId"))
      );
    },
  },
  {
    pattern: /^\/companies\/(\d+)\/audits$/,
    handler: async ({ baseUrl, request, response, service }, match) => {
      const url = new URL(request.url ?? "/", baseUrl);
      sendJson(
        response,
        200,
        await service.listAudits({
          legacyCompanyId: numberParam(match[1] ?? "", "companyId"),
          fromDate: optionalString(url.searchParams.get("fromDate")),
          toDate: optionalString(url.searchParams.get("toDate")),
          limit: optionalNumber(url.searchParams.get("limit")),
          cursor: optionalString(url.searchParams.get("cursor")),
        })
      );
    },
  },
  {
    pattern: /^\/audits\/(\d+)$/,
    handler: async ({ response, service }, match) => {
      const detail = await service.getAuditDetail(
        numberParam(match[1] ?? "", "auditId")
      );
      sendJson(
        response,
        detail ? 200 : 404,
        detail ?? { error: "Audit not found" }
      );
    },
  },
  {
    pattern: /^\/audits\/(\d+)\/paces$/,
    handler: async ({ baseUrl, request, response, service }, match) => {
      const url = new URL(request.url ?? "/", baseUrl);
      sendJson(
        response,
        200,
        await service.getAuditPaces({
          legacyAuditId: numberParam(match[1] ?? "", "auditId"),
          fromDate: optionalString(url.searchParams.get("fromDate")),
          toDate: optionalString(url.searchParams.get("toDate")),
          limit: optionalNumber(url.searchParams.get("limit")),
          cursor: optionalString(url.searchParams.get("cursor")),
        })
      );
    },
  },
  {
    pattern: /^\/companies\/(\d+)\/users$/,
    handler: async ({ response, service }, match) => {
      sendJson(
        response,
        200,
        await service.listUsers(numberParam(match[1] ?? "", "companyId"))
      );
    },
  },
  {
    pattern: /^\/companies\/(\d+)\/hurdle-rates$/,
    handler: async ({ response, service }, match) => {
      sendJson(
        response,
        200,
        await service.getHurdleRates(numberParam(match[1] ?? "", "companyId"))
      );
    },
  },
  {
    pattern: /^\/companies\/(\d+)\/budgets\/rooms$/,
    handler: async ({ baseUrl, request, response, service }, match) => {
      const url = new URL(request.url ?? "/", baseUrl);
      sendJson(
        response,
        200,
        await service.getRoomBudget(
          numberParam(match[1] ?? "", "companyId"),
          numberParam(url.searchParams.get("year") ?? "", "year"),
          numberParam(url.searchParams.get("month") ?? "", "month")
        )
      );
    },
  },
  {
    pattern: /^\/companies\/(\d+)\/budgets\/revenue$/,
    handler: async ({ baseUrl, request, response, service }, match) => {
      const url = new URL(request.url ?? "/", baseUrl);
      sendJson(
        response,
        200,
        await service.getRevenueBudget(
          numberParam(match[1] ?? "", "companyId"),
          numberParam(url.searchParams.get("year") ?? "", "year"),
          numberParam(url.searchParams.get("month") ?? "", "month")
        )
      );
    },
  },
  {
    pattern: /^\/properties\/([^/]+)\/pace\/snapshot$/,
    handler: async ({ baseUrl, request, response, service }, match) => {
      const url = new URL(request.url ?? "/", baseUrl);
      sendJson(
        response,
        200,
        await service.getPaceSnapshot({
          propertyId: decodeURIComponent(match[1] ?? ""),
          asOf: url.searchParams.get("asOf") ?? "",
          fromDate: optionalString(url.searchParams.get("fromDate")),
          toDate: optionalString(url.searchParams.get("toDate")),
          limit: optionalNumber(url.searchParams.get("limit")),
          cursor: optionalString(url.searchParams.get("cursor")),
        })
      );
    },
  },
  {
    pattern: /^\/properties\/([^/]+)\/forecast\/month$/,
    handler: async ({ baseUrl, request, response, service }, match) => {
      const url = new URL(request.url ?? "/", baseUrl);
      sendJson(
        response,
        200,
        await service.getMonthForecast({
          propertyId: decodeURIComponent(match[1] ?? ""),
          asOf: url.searchParams.get("asOf") ?? "",
          month: url.searchParams.get("month") ?? "",
        })
      );
    },
  },
];

export const handleRest = async (context: HttpContext): Promise<boolean> => {
  if (context.request.method !== "GET") {
    return false;
  }

  const url = new URL(context.request.url ?? "/", context.baseUrl);

  for (const route of routes) {
    const match = url.pathname.match(route.pattern);
    if (!match) {
      continue;
    }

    try {
      await route.handler(context, match);
    } catch (error) {
      sendError(
        context.response,
        400,
        error instanceof Error ? error.message : "Request failed"
      );
    }
    return true;
  }

  return false;
};

export const writeJson = sendJson;
export const writeError = sendError;
