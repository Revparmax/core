import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarClock,
  MessageSquareText,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisProps,
  ChartTooltip,
  gridProps,
} from "@/components/charts/chart-theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { MetricCard } from "@/components/ui/metric-card";
import dashboardData from "@/data/owner-dashboard-dummy.json";
import { formatCompactUSD, formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

interface OwnerDashboardData {
  asOf: string;
  demandWindows: DemandWindow[];
  portfolio: {
    bookedNext30Revenue: number;
    budgetAttainment: number;
    budgetRevenue: number;
    confidence: string;
    forecastRevenue: number;
    freshness: string;
    lastYearRevenue: number;
    modeledMonthEndRevenue: number;
    moneyOnTable: number;
    name: string;
    projectedAdr: number;
    projectedOccupancy: number;
    projectedRevpar: number;
  };
  properties: PropertyPerformance[];
  recommendations: Recommendation[];
  trend: TrendPoint[];
}

interface TrendPoint {
  actual: number | null;
  budget: number;
  label: string;
  modeled: number;
}

interface PropertyPerformance {
  bookedNext30Revenue: number;
  budgetAttainment: number;
  budgetDelta: number;
  budgetRevenue: number;
  freshnessStatus: "current" | "watch";
  id: string;
  modeledRevenue: number;
  moneyOnTable: number;
  name: string;
  paceStatus: string;
  projectedAdr: number;
  projectedOccupancy: number;
  projectedRevpar: number;
  rooms: number;
}

interface DemandWindow {
  demand: number;
  id: string;
  label: string;
  rateGap: number;
  upside: number;
  window: string;
}

interface Recommendation {
  body: string;
  id: string;
  impact: number;
  title: string;
  tone: "neutral" | "win";
}

const dashboard = dashboardData as OwnerDashboardData;

const moneyDelta = (value: number): string =>
  `${value >= 0 ? "+" : "-"}${formatCompactUSD(Math.abs(value))}`;

const percentFromRatio = (value: number): string => formatPercent(value / 100);

const chartRows = dashboard.trend.map((point) => ({
  ...point,
  budgetLabel: point.budget,
}));

function RevenueTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
}) {
  const point = props.payload?.[0]?.payload;
  if (!(props.active && point)) {
    return null;
  }

  return (
    <ChartTooltip
      active
      rows={[
        {
          key: point.actual === null ? "Modeled" : "Actual",
          value: formatCompactUSD(point.actual ?? point.modeled),
        },
        { key: "Budget", value: formatCompactUSD(point.budget) },
      ]}
      title={point.label}
    />
  );
}

function DashboardPage() {
  const { portfolio } = dashboard;
  const budgetDelta =
    portfolio.modeledMonthEndRevenue - portfolio.budgetRevenue;
  const forecastDelta =
    portfolio.modeledMonthEndRevenue - portfolio.forecastRevenue;
  const lastYearDelta =
    portfolio.modeledMonthEndRevenue - portfolio.lastYearRevenue;

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-border border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge dot variant="live">
                Modeled portfolio
              </Badge>
              <Badge variant="neutral">{portfolio.confidence} confidence</Badge>
              <Badge variant="partial">{portfolio.freshness}</Badge>
            </div>
            <h1 className="font-display font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
              {portfolio.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" type="button" variant="outline">
              <CalendarClock aria-hidden />
              Last 30 days
            </Button>
            <Button size="lg" type="button">
              <Send aria-hidden />
              Send digest
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <div className="relative overflow-hidden rounded-lg border border-primary/25 bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,var(--ember-wash),transparent)]"
            />
            <div className="relative flex flex-col gap-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-mono text-[10px] text-mid uppercase tracking-[0.14em]">
                    Modeled month-end rooms revenue
                  </p>
                  <div className="tnum mt-2 font-display font-semibold text-5xl text-foreground tracking-tight sm:text-6xl">
                    {formatCompactUSD(portfolio.modeledMonthEndRevenue)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={budgetDelta >= 0 ? "win" : "loss"}>
                      {moneyDelta(budgetDelta)} vs budget
                    </Badge>
                    <Badge variant="neutral">
                      {moneyDelta(forecastDelta)} vs forecast
                    </Badge>
                    <Badge variant="neutral">
                      {moneyDelta(lastYearDelta)} vs LY
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 md:w-[330px]">
                  <MiniStat
                    label="Occ"
                    value={percentFromRatio(portfolio.projectedOccupancy)}
                  />
                  <MiniStat
                    label="ADR"
                    value={formatCurrency(portfolio.projectedAdr)}
                  />
                  <MiniStat
                    label="RevPAR"
                    value={formatCurrency(portfolio.projectedRevpar)}
                  />
                </div>
              </div>

              <div className="h-[260px] w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart
                    data={chartRows}
                    margin={{ bottom: 4, left: -8, right: 8, top: 12 }}
                  >
                    <defs>
                      <linearGradient
                        id="dashboard-revenue-area"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} minTickGap={18} />
                    <YAxis
                      {...axisProps}
                      tickFormatter={(value: number) => formatCompactUSD(value)}
                      width={52}
                    />
                    <Tooltip
                      content={<RevenueTooltip />}
                      cursor={{
                        stroke: "var(--chart-1)",
                        strokeDasharray: "3 3",
                        strokeOpacity: 0.55,
                      }}
                    />
                    <Area
                      dataKey="actual"
                      dot={false}
                      fill="url(#dashboard-revenue-area)"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      connectNulls
                      dataKey="modeled"
                      dot={false}
                      stroke="var(--chart-1)"
                      strokeDasharray="7 5"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      dataKey="budgetLabel"
                      dot={false}
                      stroke="var(--chart-2)"
                      strokeDasharray="2 5"
                      strokeWidth={1.8}
                      type="monotone"
                    />
                    <ReferenceLine
                      stroke="var(--line-2)"
                      strokeDasharray="2 4"
                      x="May 22"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <MetricCard
              delta={`${percentFromRatio(portfolio.budgetAttainment)} of plan`}
              direction="up"
              focus
              label="Budget position"
              value={moneyDelta(budgetDelta)}
            >
              <Meter
                max={120}
                showValue={false}
                tone="positive"
                value={portfolio.budgetAttainment}
              />
            </MetricCard>
            <MetricCard
              delta="Rate upside"
              direction="ember"
              label="Money on the table"
              value={formatCompactUSD(portfolio.moneyOnTable)}
            >
              <p className="text-[13px] text-mid">
                Concentrated in Riverport weekends and Oakville midweek group
                compression.
              </p>
            </MetricCard>
            <MetricCard
              delta="Next 30"
              direction="flat"
              label="Booked revenue"
              value={formatCompactUSD(portfolio.bookedNext30Revenue)}
            >
              <p className="text-[13px] text-mid">
                Pace remains ahead without needing comp-set rates.
              </p>
            </MetricCard>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {dashboard.properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.58fr)]">
          <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-foreground text-lg tracking-tight">
                  Demand windows
                </h2>
                <p className="mt-1 text-mid text-sm">
                  30-day windows where rate posture changes the month.
                </p>
              </div>
              <TrendingUp className="size-5 text-acc-deep" />
            </div>
            <div className="grid gap-3">
              {dashboard.demandWindows.map((window) => (
                <DemandWindowRow key={window.id} window={window} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-foreground text-lg tracking-tight">
                  Owner actions
                </h2>
                <p className="mt-1 text-mid text-sm">
                  Money-tied moves ready for a digest.
                </p>
              </div>
              <Sparkles className="size-5 text-acc-deep" />
            </div>
            <div className="grid gap-3">
              {dashboard.recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary px-3 py-2.5">
      <div className="font-mono text-[9.5px] text-mid uppercase tracking-[0.13em]">
        {label}
      </div>
      <div className="tnum mt-1 font-display font-medium text-foreground text-xl tracking-tight">
        {value}
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: PropertyPerformance }) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              dot
              variant={property.freshnessStatus === "current" ? "win" : "ember"}
            >
              {property.freshnessStatus}
            </Badge>
            <Badge variant="neutral">{property.rooms} rooms</Badge>
          </div>
          <h2 className="font-display font-semibold text-foreground text-xl tracking-tight">
            {property.name}
          </h2>
        </div>
        <ArrowUpRight className="size-5 text-pos" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniStat
          label="Modeled"
          value={formatCompactUSD(property.modeledRevenue)}
        />
        <MiniStat label="Vs budget" value={moneyDelta(property.budgetDelta)} />
        <MiniStat
          label="30-day booked"
          value={formatCompactUSD(property.bookedNext30Revenue)}
        />
        <MiniStat
          label="Upside"
          value={formatCompactUSD(property.moneyOnTable)}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Signal
          label="Occupancy"
          value={percentFromRatio(property.projectedOccupancy)}
        />
        <Signal label="ADR" value={formatCurrency(property.projectedAdr)} />
        <Signal
          label="RevPAR"
          value={formatCurrency(property.projectedRevpar)}
        />
      </div>

      <Meter
        className="mt-5"
        label={`${property.paceStatus} pace`}
        max={120}
        tone="positive"
        value={property.budgetAttainment}
      />
    </article>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border border-t pt-3">
      <div className="font-mono text-[9.5px] text-mid uppercase tracking-[0.13em]">
        {label}
      </div>
      <div className="tnum mt-1 font-display font-medium text-foreground text-lg">
        {value}
      </div>
    </div>
  );
}

function DemandWindowRow({ window }: { window: DemandWindow }) {
  const hasRateLift = window.rateGap > 0;
  return (
    <article className="grid gap-4 rounded-md border border-border bg-secondary p-4 md:grid-cols-[1fr_220px] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={hasRateLift ? "ember" : "neutral"}>
            {window.window}
          </Badge>
          <span className="text-mid text-sm">{window.label}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Signal label="Demand" value={percentFromRatio(window.demand)} />
          <Signal
            label="Rate gap"
            value={`${window.rateGap >= 0 ? "+" : ""}$${window.rateGap}`}
          />
          <Signal label="Upside" value={formatCompactUSD(window.upside)} />
        </div>
      </div>
      <Meter
        label="Demand signal"
        tone={hasRateLift ? "ember" : "positive"}
        value={window.demand}
      />
    </article>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  return (
    <article className="rounded-md border border-border bg-secondary p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
            recommendation.tone === "win"
              ? "border-pos/20 bg-pos/10 text-pos"
              : "border-border bg-card text-mid"
          )}
        >
          <MessageSquareText aria-hidden className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground text-sm">
              {recommendation.title}
            </h3>
            {recommendation.impact > 0 && (
              <Badge variant="win">
                {formatCompactUSD(recommendation.impact)}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-mid text-sm leading-5">
            {recommendation.body}
          </p>
        </div>
      </div>
    </article>
  );
}
