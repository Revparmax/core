import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function AuthWall() {
  const [showSignIn, setShowSignIn] = useState(true);

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
        Active
      </span>
    );
  }
  if (status === "pending_first_upload") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 text-xs dark:bg-amber-900/30 dark:text-amber-400">
        Needs first upload
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
      {status}
    </span>
  );
}

function PropertyList() {
  const properties = useQuery(api.properties.queries.listMyProperties);

  if (properties === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2].map((i) => (
          <div className="h-40 animate-pulse rounded-lg bg-muted" key={i} />
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No properties yet. Complete onboarding to add one.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <Card key={property._id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">
                {property.name}
              </CardTitle>
              <StatusBadge status={property.status} />
            </div>
            <CardDescription>
              {property.totalRooms} room{property.totalRooms !== 1 ? "s" : ""} ·{" "}
              {property.timezone}
            </CardDescription>
          </CardHeader>
          <CardContent />
          <CardFooter>
            <Button asChild className="w-full" size="sm">
              <Link
                params={{ propertyId: property._id }}
                to="/upload/$propertyId"
              >
                Upload report
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const profile = useQuery(api.userProfiles.queries.getMyProfile);

  useEffect(() => {
    if (profile === undefined) {
      return;
    }
    if (profile?.role === "pending_onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [profile, navigate]);

  if (profile === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <AuthWall />
      </div>
    );
  }

  if (profile === undefined || profile.role === "pending_onboarding") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-xl">Dashboard</h1>
        <UserMenu />
      </div>
      <section>
        <h2 className="mb-4 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Properties
        </h2>
        <PropertyList />
      </section>
    </div>
  );
}
