import { defineSchema } from "convex/server";
import { alerts } from "./schema/alerts";
import { auditRecords, roomStatistics } from "./schema/auditRecords";
import { budgets } from "./schema/budgets";
import { companies } from "./schema/companies";
import { competitionData, competitors } from "./schema/competition";
import { dataImports } from "./schema/dataImports";
import { extractionResults, extractorProfiles } from "./schema/extraction";
import { legacyTables } from "./schema/legacy";
import { legacyAuditSnapshots } from "./schema/legacyAuditSnapshots";
import { paceSnapshotDays } from "./schema/paceSnapshotDays";
import { paceSnapshots } from "./schema/paceSnapshots";
import { paymentRecords, paymentTypes } from "./schema/payments";
import { properties } from "./schema/properties";
import {
  nonRoomRevenue,
  revenueCategories,
  revenueParentCategories,
} from "./schema/revenue";
import { sourceRefs } from "./schema/sourceRefs";
import { userProfiles } from "./schema/userProfiles";

export default defineSchema({
  companies,
  userProfiles,
  properties,
  dataImports,
  auditRecords,
  roomStatistics,
  revenueParentCategories,
  revenueCategories,
  nonRoomRevenue,
  paymentTypes,
  paymentRecords,
  competitors,
  competitionData,
  paceSnapshots,
  budgets,
  sourceRefs,
  paceSnapshotDays,
  legacyAuditSnapshots,
  alerts,
  extractorProfiles,
  extractionResults,
  ...legacyTables,
});
