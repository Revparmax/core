import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v4";

import type { LegacyBridgeService } from "./service";

const optionalPaging = {
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().int().positive().optional(),
  cursor: z.string().optional(),
};

const toolResult = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
});

export const createMcpServer = (service: LegacyBridgeService): McpServer => {
  const server = new McpServer({
    name: "revparmax-legacy-bridge",
    version: "0.1.0",
  });

  server.registerTool(
    "list_companies",
    {
      title: "List companies",
      description: "List legacy companies with canonical company/property IDs.",
      inputSchema: {},
    },
    async () => toolResult(await service.listCompanies())
  );

  server.registerTool(
    "list_properties",
    {
      title: "List properties",
      description: "List properties for a legacy company.",
      inputSchema: { legacyCompanyId: z.number().int().positive() },
    },
    async ({ legacyCompanyId }) =>
      toolResult(await service.listProperties(legacyCompanyId))
  );

  server.registerTool(
    "list_audits",
    {
      title: "List audits",
      description: "List audits for a legacy company and optional date range.",
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
      description: "Get a joined audit detail snapshot.",
      inputSchema: { legacyAuditId: z.number().int().positive() },
    },
    async ({ legacyAuditId }) =>
      toolResult(await service.getAuditDetail(legacyAuditId))
  );

  server.registerTool(
    "get_audit_paces",
    {
      title: "Get audit paces",
      description: "Get paged paces from the canonical daily pace bucket.",
      inputSchema: {
        legacyAuditId: z.number().int().positive(),
        ...optionalPaging,
      },
    },
    async (args) => toolResult(await service.getAuditPaces(args))
  );

  server.registerTool(
    "list_users",
    {
      title: "List users",
      description: "List legacy users without password hashes.",
      inputSchema: { legacyCompanyId: z.number().int().positive() },
    },
    async ({ legacyCompanyId }) =>
      toolResult(await service.listUsers(legacyCompanyId))
  );

  server.registerTool(
    "get_hurdle_rates",
    {
      title: "Get hurdle rates",
      description: "Get hurdle rate ranges for a legacy company.",
      inputSchema: { legacyCompanyId: z.number().int().positive() },
    },
    async ({ legacyCompanyId }) =>
      toolResult(await service.getHurdleRates(legacyCompanyId))
  );

  server.registerTool(
    "get_room_budget",
    {
      title: "Get room budget",
      description: "Get monthly room budget for a legacy company.",
      inputSchema: {
        legacyCompanyId: z.number().int().positive(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      },
    },
    async ({ legacyCompanyId, year, month }) =>
      toolResult(await service.getRoomBudget(legacyCompanyId, year, month))
  );

  server.registerTool(
    "get_revenue_budget",
    {
      title: "Get revenue budget",
      description: "Get monthly revenue budget with category joins.",
      inputSchema: {
        legacyCompanyId: z.number().int().positive(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      },
    },
    async ({ legacyCompanyId, year, month }) =>
      toolResult(await service.getRevenueBudget(legacyCompanyId, year, month))
  );

  server.registerTool(
    "get_pace_snapshot",
    {
      title: "Get pace snapshot",
      description: "Get entries from a property's daily pace snapshot bucket.",
      inputSchema: {
        propertyId: z.string(),
        asOf: z.string(),
        ...optionalPaging,
      },
    },
    async (args) => toolResult(await service.getPaceSnapshot(args))
  );

  server.registerTool(
    "get_month_forecast",
    {
      title: "Get month forecast",
      description: "Get the basic TY vs LY monthly pace overlay.",
      inputSchema: {
        propertyId: z.string(),
        asOf: z.string(),
        month: z.string(),
      },
    },
    async (args) => toolResult(await service.getMonthForecast(args))
  );

  return server;
};

export const handleMcpRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  service: LegacyBridgeService
): Promise<void> => {
  const server = createMcpServer(service);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
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
