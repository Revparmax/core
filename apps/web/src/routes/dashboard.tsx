import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UserMenu from "@/components/user-menu";

// ── Types ──────────────────────────────────────────────────────────────────────

type ImportStatus =
  | "scanning"
  | "rejected"
  | "queued"
  | "extracting"
  | "failed"
  | "timeout"
  | "ready_for_verify"
  | "verified";

// ── Constants ──────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncate(s: string, max = 28): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ── Status chip ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ImportStatus, string> = {
  scanning: "Scanning",
  rejected: "Rejected",
  queued: "Queued",
  extracting: "Extracting",
  failed: "Failed",
  timeout: "Timed out",
  ready_for_verify: "Ready to verify",
  verified: "Verified",
};

const STATUS_CLASS: Record<ImportStatus, string> = {
  scanning: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  queued: "bg-muted text-muted-foreground",
  extracting:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  timeout: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ready_for_verify:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  verified:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function StatusChip({ status }: { status: ImportStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Property card ──────────────────────────────────────────────────────────────

interface RecentImport {
  _creationTime: number;
  _id: Id<"dataImports">;
  originalFilename: string;
  status: ImportStatus;
}

interface PropertySummary {
  lastAuditDate: string | null;
  property: {
    _id: Id<"properties">;
    name: string;
    totalRooms: number;
    timezone: string;
    status: string;
  };
  recentImports: RecentImport[];
}

function PropertyCard({ summary }: { summary: PropertySummary }) {
  const { property, recentImports, lastAuditDate } = summary;

  const pendingVerify = recentImports.find(
    (i) => i.status === "ready_for_verify"
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            {property.name}
          </CardTitle>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${
              property.status === "active"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            {property.status === "active" ? "Active" : "Needs first upload"}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          {property.totalRooms} room{property.totalRooms !== 1 ? "s" : ""} ·{" "}
          {property.timezone}
        </p>
        <p className="text-muted-foreground text-xs">
          {lastAuditDate
            ? `Last audit: ${lastAuditDate}`
            : "No audits confirmed yet"}
        </p>
      </CardHeader>

      <CardContent className="flex-1 pt-0 pb-3">
        {recentImports.length === 0 ? (
          <p className="text-muted-foreground text-xs">No uploads yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentImports.map((imp) => (
              <li
                className="flex items-center justify-between gap-2"
                key={imp._id}
              >
                <span className="truncate text-xs" title={imp.originalFilename}>
                  {truncate(imp.originalFilename)}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {imp.status === "ready_for_verify" ? (
                    <Link
                      className="shrink-0"
                      params={{ importId: imp._id }}
                      to="/upload/verify/$importId"
                    >
                      <StatusChip status={imp.status} />
                    </Link>
                  ) : (
                    <StatusChip status={imp.status} />
                  )}
                  <span className="text-muted-foreground text-xs">
                    {relativeTime(imp._creationTime)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-0">
        {pendingVerify && (
          <Button asChild className="w-full" size="sm">
            <Link
              params={{ importId: pendingVerify._id }}
              to="/upload/verify/$importId"
            >
              Review &amp; confirm
            </Link>
          </Button>
        )}
        <Button
          asChild
          className="w-full"
          size="sm"
          variant={pendingVerify ? "outline" : "default"}
        >
          <Link params={{ propertyId: property._id }} to="/upload/$propertyId">
            Upload report
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Add Property form ──────────────────────────────────────────────────────────

function AddPropertyForm({ onDone }: { onDone: () => void }) {
  const createProperty = useMutation(api.properties.mutations.createProperty);

  const form = useForm({
    defaultValues: {
      name: "",
      totalRooms: 1,
      timezone: "America/New_York",
    },
    onSubmit: async ({ value }) => {
      try {
        await createProperty({
          name: value.name,
          totalRooms: value.totalRooms,
          timezone: value.timezone,
        });
        toast.success("Property added");
        onDone();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Something went wrong"
        );
      }
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, "Property name is required"),
        totalRooms: z.number().int().min(1, "Must have at least 1 room"),
        timezone: z.string().min(1, "Timezone is required"),
      }),
    },
  });

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Add property</CardTitle>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <CardContent className="space-y-4 pt-0">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Property name</Label>
                <Input
                  autoFocus
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Riverport Inn"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-xs" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="totalRooms">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Total rooms</Label>
                <Input
                  id={field.name}
                  min={1}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(Number.parseInt(e.target.value, 10) || 1)
                  }
                  type="number"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-xs" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="timezone">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Timezone</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-xs" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </CardContent>
        <CardFooter className="gap-2">
          <form.Subscribe>
            {(state) => (
              <Button
                disabled={!state.canSubmit || state.isSubmitting}
                type="submit"
              >
                {state.isSubmitting ? "Saving…" : "Add property"}
              </Button>
            )}
          </form.Subscribe>
          <Button onClick={onDone} type="button" variant="ghost">
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// ── Auth wall ──────────────────────────────────────────────────────────────────

function AuthWall() {
  const [showSignIn, setShowSignIn] = useState(true);

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}

// ── Portfolio grid ─────────────────────────────────────────────────────────────

function PortfolioGrid({
  portfolio,
}: {
  portfolio: PropertySummary[] | undefined;
}) {
  if (portfolio === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2].map((i) => (
          <div className="h-52 animate-pulse rounded-lg bg-muted" key={i} />
        ))}
      </div>
    );
  }

  if (portfolio.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No properties yet. Complete onboarding to add one.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {portfolio.map((summary) => (
        <PropertyCard key={summary.property._id} summary={summary} />
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const profile = useQuery(api.userProfiles.queries.getMyProfile);
  const portfolio = useQuery(
    api.dashboard.queries.getPortfolioDashboard,
    profile == null ? "skip" : {}
  );
  const [showAddForm, setShowAddForm] = useState(false);

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Properties
          </h2>
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Add property
            </Button>
          )}
        </div>

        {showAddForm && (
          <AddPropertyForm onDone={() => setShowAddForm(false)} />
        )}

        <PortfolioGrid portfolio={portfolio} />
      </section>
    </div>
  );
}
