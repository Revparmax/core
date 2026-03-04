import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { betterAuth } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

// biome-ignore lint/style/noNonNullAssertion: SITE_URL is required at runtime; missing value causes auth failure
const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // ADR-014: create a placeholder userProfile atomically on sign-up so no
    // authenticated user can ever land in a "No profile" state.
    // requireRunMutationCtx narrows GenericCtx to a type that exposes runMutation;
    // safe here because createAuth is only ever called from HTTP action handlers.
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const mutCtx = requireRunMutationCtx(ctx);
            await mutCtx.runMutation(
              internal.userProfiles.mutations.createPlaceholder,
              { userId: user.id }
            );
          },
        },
      },
    },
    plugins: [
      convex({
        authConfig,
        jwksRotateOnTokenGenerationError: true,
      }),
    ],
  });
}

export { createAuth };

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.safeGetAuthUser(ctx);
  },
});
