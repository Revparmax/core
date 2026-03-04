import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

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

type OnboardingStep = "loading" | "company" | "property";

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-muted-foreground text-xs">
        Step {current} of {total}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Step 1 — Company ───────────────────────────────────────────────────────────

function CompanyStep({
  onComplete,
}: {
  onComplete: (id: Id<"companies">) => void;
}) {
  const createCompany = useMutation(api.companies.mutations.createCompany);
  const completeOnboarding = useMutation(
    api.userProfiles.mutations.completeOnboarding
  );

  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      try {
        const companyId = await createCompany({ name: value.name });
        await completeOnboarding({ companyId, role: "owner" });
        onComplete(companyId);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Something went wrong"
        );
      }
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, "Company name is required"),
      }),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your company</CardTitle>
        <CardDescription>
          This is the name your team and properties will be grouped under.
        </CardDescription>
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
                <Label htmlFor={field.name}>Company name</Label>
                <Input
                  autoFocus
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Acme Hospitality Group"
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
        </CardContent>
        <CardFooter>
          <form.Subscribe>
            {(state) => (
              <Button
                className="w-full"
                disabled={!state.canSubmit || state.isSubmitting}
                type="submit"
              >
                {state.isSubmitting ? "Saving…" : "Continue"}
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}

// ── Step 2 — First property ────────────────────────────────────────────────────

function PropertyStep({ onComplete }: { onComplete: () => void }) {
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
        onComplete();
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
    <Card>
      <CardHeader>
        <CardTitle>Add your first property</CardTitle>
        <CardDescription>
          You can add more properties and configure alert thresholds later.
        </CardDescription>
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
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
        <CardFooter>
          <form.Subscribe>
            {(state) => (
              <Button
                className="w-full"
                disabled={!state.canSubmit || state.isSubmitting}
                type="submit"
              >
                {state.isSubmitting ? "Saving…" : "Finish setup"}
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

function OnboardingPage() {
  const navigate = useNavigate();
  const profile = useQuery(api.userProfiles.queries.getMyProfile);
  const [step, setStep] = useState<OnboardingStep>("loading");

  useEffect(() => {
    if (step !== "loading") {
      return;
    }
    if (profile === undefined) {
      return;
    }
    if (profile === null || profile.role !== "pending_onboarding") {
      navigate({ to: "/dashboard" });
      return;
    }
    setStep("company");
  }, [profile, step, navigate]);

  if (step === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-12 w-full max-w-lg px-4">
      <StepIndicator current={step === "company" ? 1 : 2} total={2} />
      {step === "company" && (
        <CompanyStep
          onComplete={() => {
            setStep("property");
          }}
        />
      )}
      {step === "property" && (
        <PropertyStep
          onComplete={() => {
            navigate({ to: "/dashboard" });
          }}
        />
      )}
    </div>
  );
}
