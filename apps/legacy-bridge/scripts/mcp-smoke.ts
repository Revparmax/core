import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const mcpUrl = process.env.LEGACY_BRIDGE_MCP_URL ?? "http://127.0.0.1:8787/mcp";

interface ToolResult {
  content: Array<{ text?: string; type?: string }>;
}

const asToolResult = (value: unknown): ToolResult => {
  if (
    !value ||
    typeof value !== "object" ||
    !("content" in value) ||
    !Array.isArray((value as ToolResult).content)
  ) {
    throw new Error("MCP tool result did not include content");
  }

  return value as ToolResult;
};

const parseToolJson = (result: ToolResult): unknown => {
  const firstContent = result.content[0];
  if (!firstContent?.text) {
    throw new Error("MCP tool result did not include text JSON");
  }
  return JSON.parse(firstContent.text) as unknown;
};

const assertObject = (
  value: unknown,
  label: string
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} did not return an object`);
  }
  return value as Record<string, unknown>;
};

const assertArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} did not return an array`);
  }
  return value;
};

const main = async () => {
  const client = new Client({
    name: "legacy-bridge-smoke",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

  await client.connect(transport);
  const companies = asToolResult(
    await client.callTool({
      name: "list_companies",
      arguments: {},
    })
  );
  const companiesJson = assertArray(parseToolJson(companies), "companies");
  const company = companiesJson
    .map((value) => assertObject(value, "company"))
    .find((value) => value.legacyCompanyId === 103);
  if (!company || typeof company.propertyId !== "string") {
    throw new Error("MCP companies result omitted canonical property ID");
  }

  const audit = parseToolJson(
    asToolResult(
      await client.callTool({
        name: "get_audit_detail",
        arguments: { legacyAuditId: 20_265 },
      })
    )
  );
  const auditHeader = assertObject(assertObject(audit, "audit").audit, "audit");
  if (auditHeader.legacyAuditId !== 20_265) {
    throw new Error("MCP audit detail did not match REST smoke audit");
  }

  const forecast = parseToolJson(
    asToolResult(
      await client.callTool({
        name: "get_month_forecast",
        arguments: {
          propertyId: company.propertyId,
          asOf: "2026-05-22",
          month: "2026-05",
        },
      })
    )
  );
  const forecastRows = assertArray(
    assertObject(forecast, "forecast").rows,
    "forecast rows"
  );

  if (companies.content.length === 0 || forecastRows.length === 0) {
    throw new Error("MCP tool returned no content");
  }

  const auditAgain = asToolResult(
    await client.callTool({
      name: "get_audit_detail",
      arguments: { legacyAuditId: 20_266 },
    })
  );
  if (auditAgain.content.length === 0) {
    throw new Error("MCP audit 20266 returned no content");
  }

  await client.close();
  console.log("Legacy bridge MCP smoke passed.");
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
