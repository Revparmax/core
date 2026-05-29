import { describe, expect, it } from "bun:test";

import { openApiSpec } from "./openapi";

describe("production OpenAPI spec", () => {
  it("exposes the production API identity", () => {
    expect(openApiSpec.info.title).toBe("RevParMax API");
    expect(openApiSpec.servers[0]?.url).toBe("http://127.0.0.1:8788");
  });

  it("keeps migration-only user and hurdle routes out of the production API", () => {
    const paths = Object.keys(openApiSpec.paths);

    expect(paths).not.toContain("/companies/{companyId}/users");
    expect(paths).not.toContain("/companies/{companyId}/hurdle-rates");
  });
});
