import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v4";

import type { RevparmaxApiService } from "./service";

const optionalPaging = {
  cursor: z.string().optional(),
  fromDate: z.string().optional(),
  limit: z.number().int().positive().optional(),
  toDate: z.string().optional(),
};

const toolResult = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
});

export const createMcpServer = (service: RevparmaxApiService): McpServer => {
  const server = new McpServer({
    name: "revparmax-api",
    version: "0.1.0",
  });

  server.registerTool(
    "list_companies",
    {
      title: "List companies",
      description: "List companies with canonical company and property IDs.",
      inputSchema: {},
    },
    async () => toolResult(await service.listCompanies())
  );

  server.registerTool(
    "list_properties",
    {
      title: "List properties",
      description: "List properties for a company imported into RevParMax.",
      inputSchema: { legacyCompanyId: z.number().int().positive() },
    },
    async ({ legacyCompanyId }) =>
      toolResult(await service.listProperties(legacyCompanyId))
  );

  server.registerTool(
    "list_audits",
    {
      title: "List audits",
      description: "List audit records for a company and optional date range.",
      inputSchema: {
        legacyCompanyId: z.number().int().positive(),
        ...optionalPaging,
      },
    },
    async (args) => toolResult(await service.listAudits(args))
  );

  server.registerTool(
    "get_audit_detail",
    {
      title: "Get audit detail",
      description: "Get joined audit detail from canonical review tables.",
      inputSchema: { legacyAuditId: z.number().int().positive() },
    },
    async ({ legacyAuditId }) =>
      toolResult(await service.getAuditDetail(legacyAuditId))
  );

  server.registerTool(
    "get_audit_paces",
    {
      title: "Get audit paces",
      description: "Get paged pace rows from canonical daily pace snapshots.",
      inputSchema: {
        legacyAuditId: z.number().int().positive(),
        ...optionalPaging,
      },
    },
    async (args) => toolResult(await service.getAuditPaces(args))
  );

  server.registerTool(
    "get_room_budget",
    {
      title: "Get room budget",
      description: "Get monthly room budget for a company.",
      inputSchema: {
        legacyCompanyId: z.number().int().positive(),
        month: z.number().int().min(1).max(12),
        year: z.number().int(),
      },
    },
    async ({ legacyCompanyId, month, year }) =>
      toolResult(await service.getRoomBudget(legacyCompanyId, year, month))
  );

  server.registerTool(
    "get_revenue_budget",
    {
      title: "Get revenue budget",
      description: "Get monthly revenue budget with category joins.",
      inputSchema: {
        legacyCompanyId: z.number().int().positive(),
        month: z.number().int().min(1).max(12),
        year: z.number().int(),
      },
    },
    async ({ legacyCompanyId, month, year }) =>
      toolResult(await service.getRevenueBudget(legacyCompanyId, year, month))
  );

  server.registerTool(
    "get_pace_snapshot",
    {
      title: "Get pace snapshot",
      description: "Get entries from a property's daily pace snapshot bucket.",
      inputSchema: {
        asOf: z.string(),
        propertyId: z.string(),
        ...optionalPaging,
      },
    },
    async (args) => toolResult(await service.getPaceSnapshot(args))
  );

  server.registerTool(
    "get_month_forecast",
    {
      title: "Get month forecast",
      description: "Get the TY vs LY monthly pace overlay.",
      inputSchema: {
        asOf: z.string(),
        month: z.string(),
        propertyId: z.string(),
      },
    },
    async (args) => toolResult(await service.getMonthForecast(args))
  );

  return server;
};

export const handleMcpRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  service: RevparmaxApiService
): Promise<void> => {
  const server = createMcpServer(service);
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } finally {
    response.on("close", () => {
      Promise.all([transport.close(), server.close()]).catch(
        (error: unknown) => {
          console.error("Failed to close MCP transport", error);
        }
      );
    });
  }
};
