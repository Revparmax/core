export const openApiSpec = {
  info: {
    description:
      "Production read-only OpenAPI surface over canonical RevParMax review data.",
    title: "RevParMax API",
    version: "0.1.0",
  },
  openapi: "3.1.0",
  paths: {
    "/audits/{auditId}": {
      get: {
        operationId: "getAuditDetail",
        parameters: [pathInteger("auditId")],
        responses: {
          "200": {
            description:
              "Joined audit detail from canonical audit, room, revenue, payment, competition, and pace tables.",
          },
        },
      },
    },
    "/audits/{auditId}/paces": {
      get: {
        operationId: "getAuditPaces",
        parameters: [
          pathInteger("auditId"),
          queryString("fromDate"),
          queryString("toDate"),
          queryInteger("limit"),
          queryString("cursor"),
        ],
        responses: {
          "200": {
            description: "Paged pace rows served from canonical daily buckets.",
          },
        },
      },
    },
    "/companies": {
      get: {
        operationId: "listCompanies",
        responses: {
          "200": { description: "Companies with canonical IDs" },
        },
      },
    },
    "/companies/{companyId}/audits": {
      get: {
        operationId: "listAudits",
        parameters: [
          pathInteger("companyId"),
          queryString("fromDate"),
          queryString("toDate"),
          queryInteger("limit"),
          queryString("cursor"),
        ],
        responses: { "200": { description: "Paged audit records" } },
      },
    },
    "/companies/{companyId}/budgets/revenue": {
      get: {
        operationId: "getRevenueBudget",
        parameters: [
          pathInteger("companyId"),
          requiredQueryInteger("year"),
          requiredQueryInteger("month"),
        ],
        responses: {
          "200": { description: "Monthly revenue budget with joins" },
        },
      },
    },
    "/companies/{companyId}/budgets/rooms": {
      get: {
        operationId: "getRoomBudget",
        parameters: [
          pathInteger("companyId"),
          requiredQueryInteger("year"),
          requiredQueryInteger("month"),
        ],
        responses: { "200": { description: "Monthly room budget" } },
      },
    },
    "/companies/{companyId}/properties": {
      get: {
        operationId: "listProperties",
        parameters: [pathInteger("companyId")],
        responses: {
          "200": { description: "Properties for a company" },
        },
      },
    },
    "/health": {
      get: {
        operationId: "getHealth",
        responses: { "200": { description: "API health status" } },
      },
    },
    "/properties/{propertyId}/forecast/month": {
      get: {
        operationId: "getMonthForecast",
        parameters: [
          pathString("propertyId"),
          requiredQueryString("asOf"),
          requiredQueryString("month"),
        ],
        responses: { "200": { description: "TY vs LY monthly pace overlay" } },
      },
    },
    "/properties/{propertyId}/pace/snapshot": {
      get: {
        operationId: "getPaceSnapshot",
        parameters: [
          pathString("propertyId"),
          requiredQueryString("asOf"),
          queryString("fromDate"),
          queryString("toDate"),
          queryInteger("limit"),
          queryString("cursor"),
        ],
        responses: {
          "200": { description: "Daily pace snapshot bucket entries" },
        },
      },
    },
  },
  servers: [{ url: "http://127.0.0.1:8788" }],
} as const;

function pathInteger(name: string) {
  return {
    in: "path",
    name,
    required: true,
    schema: { type: "integer" },
  } as const;
}

function pathString(name: string) {
  return {
    in: "path",
    name,
    required: true,
    schema: { type: "string" },
  } as const;
}

function queryString(name: string) {
  return {
    in: "query",
    name,
    required: false,
    schema: { type: "string" },
  } as const;
}

function requiredQueryString(name: string) {
  return {
    ...queryString(name),
    required: true,
  } as const;
}

function queryInteger(name: string) {
  return {
    in: "query",
    name,
    required: false,
    schema: { type: "integer" },
  } as const;
}

function requiredQueryInteger(name: string) {
  return {
    ...queryInteger(name),
    required: true,
  } as const;
}
