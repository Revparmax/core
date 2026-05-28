export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "RevParMax Legacy Bridge API",
    version: "0.1.0",
    description:
      "Local read-only OpenAPI surface over canonical RevParMax read models and low-volume legacy lookup joins.",
  },
  servers: [{ url: "http://127.0.0.1:8787" }],
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        responses: { "200": { description: "Bridge health status" } },
      },
    },
    "/companies": {
      get: {
        operationId: "listCompanies",
        responses: {
          "200": { description: "Legacy companies with canonical IDs" },
        },
      },
    },
    "/companies/{companyId}/properties": {
      get: {
        operationId: "listProperties",
        parameters: [pathInteger("companyId")],
        responses: {
          "200": { description: "Properties for a legacy company" },
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
        responses: { "200": { description: "Paged legacy audits" } },
      },
    },
    "/audits/{auditId}": {
      get: {
        operationId: "getAuditDetail",
        parameters: [pathInteger("auditId")],
        responses: { "200": { description: "Joined audit detail snapshot" } },
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
            description:
              "Paged pace rows served from canonical daily pace buckets, not raw legacyPaces",
          },
        },
      },
    },
    "/companies/{companyId}/users": {
      get: {
        operationId: "listUsers",
        parameters: [pathInteger("companyId")],
        responses: {
          "200": {
            description:
              "Legacy users with password hashes omitted and passwordHashPresent metadata",
          },
        },
      },
    },
    "/companies/{companyId}/hurdle-rates": {
      get: {
        operationId: "getHurdleRates",
        parameters: [pathInteger("companyId")],
        responses: { "200": { description: "Company hurdle rate ranges" } },
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
  },
} as const;

function pathInteger(name: string) {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "integer" },
  } as const;
}

function pathString(name: string) {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  } as const;
}

function queryString(name: string) {
  return {
    name,
    in: "query",
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
    name,
    in: "query",
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
