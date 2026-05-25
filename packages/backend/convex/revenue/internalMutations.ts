import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

interface ParentDef {
  children: { name: string; displayOrder: number }[];
  displayOrder: number;
  name: string;
}

const DEFAULT_CATEGORIES: ParentDef[] = [
  {
    name: "Food & Beverage",
    displayOrder: 1,
    children: [
      { name: "Restaurant", displayOrder: 1 },
      { name: "Room Service", displayOrder: 2 },
      { name: "Bar & Lounge", displayOrder: 3 },
      { name: "Coffee Shop", displayOrder: 4 },
      { name: "Minibar", displayOrder: 5 },
      { name: "Banquet Food", displayOrder: 6 },
      { name: "Banquet Beverage", displayOrder: 7 },
      { name: "Miscellaneous", displayOrder: 8 },
    ],
  },
  {
    name: "Meetings & Events",
    displayOrder: 2,
    children: [
      { name: "Room Rental", displayOrder: 1 },
      { name: "Equipment Rental", displayOrder: 2 },
      { name: "Service Charges", displayOrder: 3 },
      { name: "Miscellaneous", displayOrder: 4 },
    ],
  },
  {
    name: "Spa & Wellness",
    displayOrder: 3,
    children: [
      { name: "Spa", displayOrder: 1 },
      { name: "Gym", displayOrder: 2 },
      { name: "Beauty Salon", displayOrder: 3 },
      { name: "Miscellaneous", displayOrder: 4 },
    ],
  },
  {
    name: "Guest Services",
    displayOrder: 4,
    children: [
      { name: "Parking", displayOrder: 1 },
      { name: "Laundry & Valet", displayOrder: 2 },
      { name: "Coin Laundry", displayOrder: 3 },
      { name: "Pay Per View / Movies", displayOrder: 4 },
      { name: "Miscellaneous", displayOrder: 5 },
    ],
  },
  {
    name: "Telecommunications",
    displayOrder: 5,
    children: [
      { name: "Phone", displayOrder: 1 },
      { name: "Internet", displayOrder: 2 },
      { name: "Fax & Photocopy", displayOrder: 3 },
      { name: "Miscellaneous", displayOrder: 4 },
    ],
  },
  {
    name: "Retail & Concessions",
    displayOrder: 6,
    children: [
      { name: "Gift Shop & Souvenirs", displayOrder: 1 },
      { name: "Market & Pantry", displayOrder: 2 },
      { name: "Beer & Wine", displayOrder: 3 },
      { name: "Miscellaneous", displayOrder: 4 },
    ],
  },
  {
    name: "Recreational",
    displayOrder: 7,
    children: [
      { name: "Golf", displayOrder: 1 },
      { name: "Tennis", displayOrder: 2 },
      { name: "Skiing", displayOrder: 3 },
      { name: "Miscellaneous", displayOrder: 4 },
    ],
  },
  {
    name: "Other Revenue",
    displayOrder: 8,
    children: [
      { name: "Package Components", displayOrder: 1 },
      { name: "Damage Charges", displayOrder: 2 },
      { name: "Miscellaneous", displayOrder: 3 },
    ],
  },
];

// Seeds the default revenue category hierarchy for a newly created property.
// Scheduled via ctx.scheduler.runAfter(0, ...) from createProperty so it runs
// asynchronously and does not add latency to onboarding.
export const seedDefaultCategories = internalMutation({
  args: {
    propertyId: v.id("properties"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { propertyId, companyId }) => {
    for (const parent of DEFAULT_CATEGORIES) {
      const parentId = await ctx.db.insert("revenueParentCategories", {
        propertyId,
        companyId,
        name: parent.name,
        displayOrder: parent.displayOrder,
      });

      for (const child of parent.children) {
        await ctx.db.insert("revenueCategories", {
          propertyId,
          companyId,
          parentId,
          name: child.name,
          displayOrder: child.displayOrder,
        });
      }
    }
  },
});
