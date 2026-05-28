const baseUrl = process.env.LEGACY_BRIDGE_URL ?? "http://127.0.0.1:8787";

const getJson = async (path: string): Promise<unknown> => {
  const response = await fetch(new URL(path, baseUrl));
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return await response.json();
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

const propertyIdForCompany = (
  companies: unknown[],
  legacyCompanyId: number
) => {
  const company = companies
    .map((value) => assertObject(value, "company"))
    .find((value) => value.legacyCompanyId === legacyCompanyId);
  if (!company || typeof company.propertyId !== "string") {
    throw new Error(`No canonical property ID found for ${legacyCompanyId}`);
  }
  return company.propertyId;
};

const assertAudit = async (legacyAuditId: number) => {
  const audit = assertObject(
    await getJson(`/audits/${legacyAuditId}`),
    "audit detail"
  );
  const auditHeader = assertObject(audit.audit, "audit detail header");
  if (auditHeader.legacyAuditId !== legacyAuditId) {
    throw new Error(`Audit ${legacyAuditId} was not returned`);
  }
};

const main = async () => {
  const openapi = assertObject(await getJson("/openapi.json"), "openapi");
  if (openapi.openapi !== "3.1.0") {
    throw new Error("OpenAPI schema is not 3.1.0");
  }

  const companies = assertArray(await getJson("/companies"), "companies");
  const propertyId = propertyIdForCompany(companies, 103);

  await assertAudit(20_265);
  await assertAudit(20_266);

  const users = assertArray(await getJson("/companies/103/users"), "users");
  if (JSON.stringify(users).includes('"password"')) {
    throw new Error("User payload exposed a password field");
  }

  const paces = assertObject(
    await getJson("/audits/20265/paces?limit=5"),
    "audit paces"
  );
  const paceItems = assertArray(paces.items, "audit pace items");
  if (paceItems.length > 5) {
    throw new Error("Pace pagination limit was not applied");
  }

  const forecast = assertObject(
    await getJson(
      `/properties/${encodeURIComponent(
        propertyId
      )}/forecast/month?asOf=2026-05-22&month=2026-05`
    ),
    "month forecast"
  );
  const rows = assertArray(forecast.rows, "forecast rows");
  if (rows.length === 0) {
    throw new Error("Forecast returned no rows");
  }
  const firstRow = assertObject(rows[0], "forecast row");
  for (const key of ["tyRooms", "lyRooms", "paceNet", "warnings"]) {
    if (!(key in firstRow)) {
      throw new Error(`Forecast row omitted ${key}`);
    }
  }

  console.log("Legacy bridge REST smoke passed.");
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
