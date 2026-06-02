import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";

import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";

import Header from "../components/header";
import appCss from "../index.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken().catch(() => null);
});

export interface RouterAppContext {
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "My App",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
    ],
  }),

  component: RootDocument,
  beforeLoad: async (ctx) => {
    const token = await getAuth();
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return {
      isAuthenticated: !!token,
      token,
    };
  },
});

const DESIGN_SURFACE_PATHS = ["/design", "/brand"];
const LIGHT_THEME_PATHS = ["/brand"];

function RootDocument() {
  const context = useRouteContext({ from: Route.id });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDesignSurface = DESIGN_SURFACE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isLightOnly = LIGHT_THEME_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  return (
    <ConvexBetterAuthProvider
      authClient={authClient}
      client={context.convexQueryClient.convexClient}
      initialToken={context.token}
    >
      <html className={isLightOnly ? "" : "dark"} lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          {isDesignSurface ? (
            <div className="h-svh">
              <Outlet />
            </div>
          ) : (
            <div className="grid h-svh grid-rows-[auto_1fr]">
              <Header />
              <Outlet />
            </div>
          )}
          <Toaster richColors />
          <TanStackRouterDevtools position="bottom-left" />
          <Scripts />
        </body>
      </html>
    </ConvexBetterAuthProvider>
  );
}
