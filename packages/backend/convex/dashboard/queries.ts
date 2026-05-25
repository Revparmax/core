import { query } from "../_generated/server";
import { requireUserProfile } from "../lib/withAuth";

// Derives the single display status for an import from the two underlying
// status fields on dataImports and (optionally) its extractionResults doc.
function deriveImportStatus(
  scanStatus: string,
  extractionStatus: string,
  extractionResultStatus: string | null
):
  | "scanning"
  | "rejected"
  | "queued"
  | "extracting"
  | "failed"
  | "timeout"
  | "ready_for_verify"
  | "verified" {
  if (scanStatus === "infected" || scanStatus === "scan_failed") {
    return "rejected";
  }
  if (scanStatus === "pending") {
    return "scanning";
  }
  // scan is clean past here
  if (extractionStatus === "pending") {
    return "queued";
  }
  if (extractionStatus === "in_progress") {
    return "extracting";
  }
  if (extractionStatus === "failed") {
    return "failed";
  }
  if (extractionStatus === "timeout") {
    return "timeout";
  }
  // extractionStatus === "completed"
  if (extractionResultStatus === "verified") {
    return "verified";
  }
  return "ready_for_verify";
}

// Returns a portfolio summary for the authenticated user's company.
// For each property: the last 3 uploads with derived status + the most
// recent verified audit date. Designed to power the dashboard in a single
// reactive subscription.
export const getPortfolioDashboard = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireUserProfile(ctx);

    if (!profile.companyId) {
      return [];
    }

    const { companyId } = profile;

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
      .collect();

    const summaries = await Promise.all(
      properties.map(async (property) => {
        // Last 3 imports, newest first.
        const recentImports = await ctx.db
          .query("dataImports")
          .withIndex("by_propertyId", (q) => q.eq("propertyId", property._id))
          .order("desc")
          .take(3);

        // For each completed import, fetch the extraction result status only.
        const importsWithStatus = await Promise.all(
          recentImports.map(async (imp) => {
            let extractionResultStatus: string | null = null;

            if (imp.extractionStatus === "completed") {
              const result = await ctx.db
                .query("extractionResults")
                .withIndex("by_importId", (q) => q.eq("importId", imp._id))
                .first();
              extractionResultStatus = result?.status ?? null;
            }

            return {
              _id: imp._id,
              originalFilename: imp.originalFilename,
              _creationTime: imp._creationTime,
              status: deriveImportStatus(
                imp.scanStatus,
                imp.extractionStatus,
                extractionResultStatus
              ),
            };
          })
        );

        // Most recent verified audit record for this property.
        const lastAudit = await ctx.db
          .query("auditRecords")
          .withIndex("by_propertyId_date", (q) =>
            q.eq("propertyId", property._id)
          )
          .order("desc")
          .filter((q) => q.eq(q.field("status"), "verified"))
          .first();

        return {
          property,
          recentImports: importsWithStatus,
          lastAuditDate: lastAudit?.auditDate ?? null,
        };
      })
    );

    return summaries;
  },
});
