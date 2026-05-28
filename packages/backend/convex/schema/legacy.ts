import { defineTable } from "convex/server";
import { v } from "convex/values";

const defineLegacyTable = () =>
  defineTable({
    legacyId: v.optional(v.number()),
    row: v.any(),
  }).index("by_legacyId", ["legacyId"]);

export const legacyTables = {
  legacyAuditDataTypes: defineLegacyTable(),
  legacyAuditMessages: defineLegacyTable(),
  legacyAudits: defineLegacyTable(),
  legacyAuthTokens: defineLegacyTable(),
  legacyBudgetRevenues: defineLegacyTable(),
  legacyBudgetRooms: defineLegacyTable(),
  legacyCompanies: defineLegacyTable(),
  legacyCompetitionExtcodes: defineLegacyTable(),
  legacyCompetitionStats: defineLegacyTable(),
  legacyCompetitions: defineLegacyTable(),
  legacyDataImports: defineLegacyTable(),
  legacyFiles: defineLegacyTable(),
  legacyFutureRooms: defineLegacyTable(),
  legacyHurdleRates: defineLegacyTable(),
  legacyLogs: defineLegacyTable(),
  legacyMigrations: defineLegacyTable(),
  legacyPaces: defineLegacyTable(),
  legacyPasswordReminders: defineLegacyTable(),
  legacyPaymentTypeExtcodes: defineLegacyTable(),
  legacyPaymentTypeStats: defineLegacyTable(),
  legacyPaymentTypes: defineLegacyTable(),
  legacyReceivedAuditDataTypes: defineLegacyTable(),
  legacyRecurlyNotifications: defineLegacyTable(),
  legacyRequiredAuditDataTypes: defineLegacyTable(),
  legacyRevenueCategories: defineLegacyTable(),
  legacyRevenueCategoryExtcodes: defineLegacyTable(),
  legacyRevenueStats: defineLegacyTable(),
  legacyRoomCategories: defineLegacyTable(),
  legacyRoomCategoryExtcodes: defineLegacyTable(),
  legacyRoomStats: defineLegacyTable(),
  legacyUsers: defineLegacyTable(),
};
