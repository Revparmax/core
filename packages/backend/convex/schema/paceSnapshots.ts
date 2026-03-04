import { defineTable } from "convex/server";
import { v } from "convex/values";

// The Living Snapshot — 365 rows captured per property per day (133,225 rows/property/year).
// Three indexes cover all forecast query patterns (see §8b for algorithm usage).
export const paceSnapshots = defineTable({
  propertyId: v.id("properties"),
  snapshotDate: v.string(), // date the snapshot was captured ("YYYY-MM-DD")
  forecastDate: v.string(), // the forward-looking stay date
  roomsOnBooks: v.number(),
  adr: v.optional(v.number()),
  source: v.string(),
  dataImportId: v.optional(v.id("dataImports")),
})
  .index("by_propertyId_forecastDate", ["propertyId", "forecastDate"])
  .index("by_propertyId_snapshotDate", ["propertyId", "snapshotDate"])
  // Pace curve query: given propertyId + forecastDate, get all snapshots ordered by snapshotDate
  .index("by_property_forecast_snapshot", [
    "propertyId",
    "forecastDate",
    "snapshotDate",
  ]);
