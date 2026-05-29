import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export interface ListAuditsArgs {
  cursor?: string;
  fromDate?: string;
  legacyCompanyId: number;
  limit?: number;
  toDate?: string;
}

export interface PagedPaceArgs {
  cursor?: string;
  fromDate?: string;
  legacyAuditId: number;
  limit?: number;
  toDate?: string;
}

export interface PaceSnapshotArgs {
  asOf: string;
  cursor?: string;
  fromDate?: string;
  limit?: number;
  propertyId: string;
  toDate?: string;
}

export interface MonthForecastArgs {
  asOf: string;
  month: string;
  propertyId: string;
}

export class RevparmaxApiService {
  private readonly client: ConvexHttpClient;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  listCompanies() {
    return this.client.query(queryRef("listCompanies"), {});
  }

  listProperties(legacyCompanyId: number) {
    return this.client.query(queryRef("listProperties"), {
      legacyCompanyId,
    });
  }

  listAudits(args: ListAuditsArgs) {
    return this.client.query(queryRef("listAudits"), args);
  }

  getAuditDetail(legacyAuditId: number) {
    return this.client.query(queryRef("getAuditDetail"), {
      legacyAuditId,
    });
  }

  getAuditPaces(args: PagedPaceArgs) {
    return this.client.query(queryRef("getAuditPaces"), args);
  }

  getRoomBudget(legacyCompanyId: number, year: number, month: number) {
    return this.client.query(queryRef("getRoomBudget"), {
      legacyCompanyId,
      month,
      year,
    });
  }

  getRevenueBudget(legacyCompanyId: number, year: number, month: number) {
    return this.client.query(queryRef("getRevenueBudget"), {
      legacyCompanyId,
      month,
      year,
    });
  }

  getPaceSnapshot(args: PaceSnapshotArgs) {
    return this.client.query(queryRef("getPaceSnapshot"), args);
  }

  getMonthForecast(args: MonthForecastArgs) {
    return this.client.query(queryRef("getMonthForecast"), args);
  }
}

const queryRef = (name: string) =>
  makeFunctionReference<"query">(`legacyBridge/queries:${name}`);
