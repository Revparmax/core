import { defineTable } from "convex/server";
import { v } from "convex/values";

export const companies = defineTable({
  name: v.string(), // validated: trim().length > 0
}).index("by_name", ["name"]);
