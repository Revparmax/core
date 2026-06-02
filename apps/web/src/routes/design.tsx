import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";

import {
  ForecastChart,
  type ForecastPoint,
} from "@/components/charts/forecast-chart";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/components/ui/stat-tile";

export const Route = createFileRoute("/design")({
  component: DesignRoute,
  head: () => ({
    meta: [{ title: "RevPARMAX — Design System" }],
  }),
});

const SAMPLE_FORECAST: ForecastPoint[] = [
  { month: "Jan", actual: 412, forecast: null },
  { month: "Feb", actual: 438, forecast: null },
  { month: "Mar", actual: 465, forecast: null },
  { month: "Apr", actual: 472, forecast: null },
  { month: "May", actual: 498, forecast: null },
  { month: "Jun", actual: 521, forecast: null },
  { month: "Jul", actual: 554, forecast: null },
  // Aug = join point: carries the actual AND seeds the forecast/band so the
  // dashed forecast line is continuous with the solid actuals line.
  { month: "Aug", actual: 568, forecast: 568, band: [568, 568] },
  { month: "Sep", actual: null, forecast: 582, band: [560, 604] },
  { month: "Oct", actual: null, forecast: 612, band: [578, 646] },
  { month: "Nov", actual: null, forecast: 638, band: [592, 684] },
  { month: "Dec", actual: null, forecast: 671, band: [605, 737] },
].map((p) => ({
  ...p,
  actual: p.actual === null ? null : p.actual * 1000,
  forecast: p.forecast === null ? null : p.forecast * 1000,
  band: p.band
    ? ([p.band[0] * 1000, p.band[1] * 1000] as [number, number])
    : undefined,
}));

function DesignRoute() {
  const [view, setView] = useState<"week" | "month" | "qtr">("month");

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-12 border-border border-b pb-8">
        <div className="font-mono text-[11px] text-mid uppercase tracking-[0.2em]">
          Design System · v1.0
        </div>
        <h1 className="mt-3 font-display font-medium text-5xl text-foreground leading-[0.98] tracking-[-0.04em]">
          RevPAR<span className="text-primary">MAX</span> — instrument-grade,{" "}
          <span className="text-mid">calmly minimal</span>
        </h1>
        <p className="mt-5 max-w-[60ch] text-[15px] text-mid leading-relaxed">
          Token-backed system on shadcn / base-ui / Tailwind v4 + recharts. Warm
          neutrals carry 95% of the surface; ember is the single accent — live
          signal, focal metric, primary action. See{" "}
          <a
            className="text-acc-deep underline-offset-4 hover:underline"
            href="/design.md"
          >
            /design.md
          </a>{" "}
          for the machine-readable contract,{" "}
          <a
            className="text-acc-deep underline-offset-4 hover:underline"
            href="/brand"
          >
            /brand
          </a>{" "}
          for the visual source of truth.
        </p>
      </header>

      <Section eyebrow="01" title="Color tokens">
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6">
          {[
            {
              name: "ember-500",
              className: "bg-primary text-primary-foreground",
            },
            { name: "ember-600", className: "bg-acc-deep text-white" },
            { name: "ember-50", className: "bg-accent text-acc-deep" },
            {
              name: "background",
              className: "bg-background text-foreground border border-border",
            },
            {
              name: "card",
              className: "bg-card text-card-foreground border border-border",
            },
            {
              name: "surface-2",
              className: "bg-surface-2 text-foreground border border-border",
            },
            { name: "foreground", className: "bg-foreground text-background" },
            { name: "mid", className: "bg-mid text-background" },
            { name: "low", className: "bg-low text-background" },
            { name: "pos", className: "bg-pos text-white" },
            { name: "neg", className: "bg-neg text-white" },
            { name: "border", className: "bg-border text-foreground" },
          ].map((sw) => (
            <div
              className={`flex h-20 flex-col justify-between rounded-md p-3 ${sw.className}`}
              key={sw.name}
            >
              <div className="font-semibold text-xs">{sw.name}</div>
              <div className="font-mono text-[10px] opacity-70">{`bg-${sw.name}`}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="02" title="Typography">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <div className="font-display font-medium text-4xl text-foreground tracking-tight">
              Aa
            </div>
            <div className="mt-3 font-semibold text-sm">Space Grotesk</div>
            <div className="mt-1 font-mono text-[11px] text-mid uppercase tracking-[0.06em]">
              Display · 500/600
            </div>
            <div className="mt-2 text-[13px] text-mid">
              Headings, hero numerals
            </div>
          </Card>
          <Card>
            <div className="font-medium font-sans text-4xl text-foreground tracking-tight">
              Aa
            </div>
            <div className="mt-3 font-semibold text-sm">Hanken Grotesk</div>
            <div className="mt-1 font-mono text-[11px] text-mid uppercase tracking-[0.06em]">
              Body · 400-800
            </div>
            <div className="mt-2 text-[13px] text-mid">UI &amp; long-form</div>
          </Card>
          <Card>
            <div className="font-mono text-4xl text-foreground">123</div>
            <div className="mt-3 font-semibold text-sm">IBM Plex Mono</div>
            <div className="mt-1 font-mono text-[11px] text-mid uppercase tracking-[0.06em]">
              Mono · numbers
            </div>
            <div className="mt-2 text-[13px] text-mid">
              Tabular-nums everywhere
            </div>
          </Card>
        </div>
      </Section>

      <Section eyebrow="03" title="Controls">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Segmented
              onValueChange={setView}
              options={[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "qtr", label: "Quarter" },
              ]}
              value={view}
            />
            <Badge dot variant="live">
              Live
            </Badge>
            <Badge variant="ember">Ember</Badge>
            <Badge variant="win">+ Win</Badge>
            <Badge variant="loss">- Loss</Badge>
            <Badge variant="neutral">Neutral</Badge>
          </div>
        </Card>
      </Section>

      <Section eyebrow="04" title="Data display">
        <div className="grid gap-3 md:grid-cols-4">
          <StatTile delta="4.8%" direction="up" label="RevPAR" value="$214" />
          <StatTile delta="1.2pt" direction="up" label="ADR" value="$268" />
          <StatTile
            delta="0.6pt"
            direction="down"
            label="Occupancy"
            value="79.8%"
          />
          <StatTile delta="2.1%" direction="up" label="GOP %" value="42.4%" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <MetricCard
            delta="+8.4%"
            deltaNote="vs LY"
            direction="ember"
            focus
            label="Net Revenue · QTD"
            value="$1.84M"
          />
          <MetricCard
            delta="+2.1%"
            deltaNote="vs LY"
            direction="up"
            label="ADR"
            value="$268"
          />
          <MetricCard
            delta="-0.6pt"
            deltaNote="vs LY"
            direction="down"
            label="Occupancy"
            value="79.8%"
          />
        </div>
      </Section>

      <Section eyebrow="05" title="Charts — ignite on reveal">
        <ForecastChart
          data={SAMPLE_FORECAST}
          nowIndex={7}
          projectedDelta="+12% vs LY"
          projectedLabel="Projected · Dec"
          projectedValue={671_000}
        />
      </Section>

      <Section eyebrow="06" title="Banners">
        <div className="grid gap-3">
          <Banner
            description="Compression is forming over OCT 18-22. Lift ADR ~$18 to capture the surge."
            icon={<Sparkles />}
            title="Ember signal · revenue opportunity"
            variant="ember"
          />
          <Banner
            description="Pace is +12% over budget; revenue forecast adjusted upward."
            icon={<TrendingUp />}
            title="Forecast updated"
            variant="positive"
          />
          <Banner
            description="STAR feed is 6 hours stale; comp-set decisions may be off-trend."
            icon={<AlertTriangle />}
            title="Data feed warning"
            variant="negative"
          />
        </div>
      </Section>

      <footer className="mt-20 border-border border-t pt-6 font-mono text-[11px] text-mid uppercase tracking-[0.1em]">
        RevPARMAX Design System · /design.md · /brand
      </footer>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-5 flex items-baseline gap-4">
        <span className="font-mono text-[11px] text-mid tracking-[0.16em]">
          {eyebrow}
        </span>
        <h2 className="font-display font-semibold text-2xl text-foreground tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}
