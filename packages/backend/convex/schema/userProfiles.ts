import { defineTable } from "convex/server";
import { v } from "convex/values";

// Bridges Better Auth users to RevParMax companies and properties.
// companyId is optional: placeholder profile created at sign-up via onUserCreate hook (ADR-014).
// pending_onboarding is replaced with a real role on onboarding completion (ADR-014).
export const userProfiles = defineTable({
  userId: v.string(), // Better Auth user ID
  companyId: v.optional(v.id("companies")), // set during onboarding wizard (ADR-014)
  propertyId: v.optional(v.id("properties")), // required for auditor role
  role: v.union(
    v.literal("owner"),
    v.literal("gm"),
    v.literal("auditor"),
    v.literal("pending_onboarding") // set at sign-up; replaced on onboarding completion (ADR-014)
  ),
})
  .index("by_userId", ["userId"])
  .index("by_companyId", ["companyId"]);
