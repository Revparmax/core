import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Activity,
  Building2,
  CalendarDays,
  CircleDollarSign,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface ReviewCompany {
  legacyCompanyId: number;
  name: string | null;
  propertyId: string | null;
  totalRooms: number | null;
}

interface ReviewAuditListItem {
  date: string | undefined;
  legacyAuditId: number | null;
}

interface AuditDetail {
  audit?: {
    companyName: string | null;
    date: string;
    legacyAuditId: number;
  };
  competitionStats?: Array<{
    competitor: string | null;
    occupiedRooms: number | null;
    rate: number | null;
  }>;
  paymentTypeStats?: Array<{
    amount: number | null;
    paymentType: string | null;
  }>;
  revenueStats?: Array<{
    amount: number | null;
    parentCategory: string | null;
    revenueCategory: string | null;
  }>;
  roomStats?: Array<{
    amount: number | null;
    roomCategory: string | null;
  }>;
}

interface ForecastResult {
  rows?: Array<{
    date: string;
    lyComparableRooms: number | null;
    projectedRooms: number | null;
    tyRooms: number | null;
  }>;
  summary?: {
    projectedAdr: number | null;
    projectedOccupancy: number | null;
    projectedRevenue: number | null;
    projectedRooms: number | null;
  };
}

const asCompanies = (value: unknown): ReviewCompany[] =>
  Array.isArray(value) ? (value as ReviewCompany[]) : [];

const asAuditItems = (value: unknown): ReviewAuditListItem[] => {
  if (!value || typeof value !== "object" || !("items" in value)) {
    return [];
  }
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? (items as ReviewAuditListItem[]) : [];
};

const asAuditDetail = (value: unknown): AuditDetail | null =>
  value && typeof value === "object" ? (value as AuditDetail) : null;

const asForecast = (value: unknown): ForecastResult | null =>
  value && typeof value === "object" ? (value as ForecastResult) : null;

const money = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : currencyFormatter.format(value);

const numberText = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : numberFormatter.format(value);

const isValidIsoDate = (value: string | undefined): value is string => {
  if (!(value && ISO_DATE_REGEX.test(value))) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year > 0 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<{ cells: Array<string | number | null>; id: string }>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            {columns.map((column) => (
              <th className="px-3 py-2 text-left font-medium" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-3 py-5 text-center text-muted-foreground"
                colSpan={columns.length}
              >
                No rows
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="border-t" key={row.id}>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    className="px-3 py-2"
                    key={`${row.id}-${columns[cellIndex]}`}
                  >
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ForecastChart({ forecast }: { forecast: ForecastResult | null }) {
  const rows = forecast?.rows ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Rooms Outlook</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart
            data={rows}
            margin={{ bottom: 8, left: 0, right: 12, top: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={28} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              dataKey="tyRooms"
              name="TY rooms"
              stroke="#2563eb"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="lyComparableRooms"
              name="LY comparable"
              stroke="#7c3aed"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="projectedRooms"
              name="Projected"
              stroke="#16a34a"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ReviewPage() {
  const companies = asCompanies(
    useQuery(api.legacyBridge.queries.listCompanies)
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null
  );
  const selectedCompany = useMemo(
    () =>
      companies.find(
        (company) => company.legacyCompanyId === selectedCompanyId
      ) ?? null,
    [companies, selectedCompanyId]
  );
  const auditsResult = useQuery(
    api.legacyBridge.queries.listAudits,
    selectedCompanyId === null
      ? "skip"
      : { legacyCompanyId: selectedCompanyId, limit: 50 }
  );
  const audits = asAuditItems(auditsResult);
  const validAudits = useMemo(
    () =>
      audits.filter(
        (audit) => audit.legacyAuditId !== null && isValidIsoDate(audit.date)
      ),
    [audits]
  );
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const selectedAudit = useMemo(
    () =>
      validAudits.find((audit) => audit.legacyAuditId === selectedAuditId) ??
      null,
    [validAudits, selectedAuditId]
  );
  const auditDetail = asAuditDetail(
    useQuery(
      api.legacyBridge.queries.getAuditDetail,
      selectedAuditId === null ? "skip" : { legacyAuditId: selectedAuditId }
    )
  );
  const forecast = asForecast(
    useQuery(
      api.legacyBridge.queries.getMonthForecast,
      selectedCompany?.propertyId && isValidIsoDate(selectedAudit?.date)
        ? {
            propertyId: selectedCompany.propertyId as Id<"properties">,
            asOf: selectedAudit.date,
            month: selectedAudit.date.slice(0, 7),
          }
        : "skip"
    )
  );

  useEffect(() => {
    if (selectedCompanyId !== null || companies.length === 0) {
      return;
    }
    const preferred =
      companies.find((company) => company.legacyCompanyId === 103) ??
      companies[0];
    setSelectedCompanyId(preferred.legacyCompanyId);
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (validAudits.length === 0) {
      setSelectedAuditId(null);
      return;
    }
    if (validAudits.some((audit) => audit.legacyAuditId === selectedAuditId)) {
      return;
    }
    setSelectedAuditId(validAudits[0].legacyAuditId);
  }, [validAudits, selectedAuditId]);

  const roomRows =
    auditDetail?.roomStats?.map((row) => ({
      id: row.roomCategory ?? "unknown-room-stat",
      cells: [row.roomCategory, numberText(row.amount)],
    })) ?? [];
  const revenueRows =
    auditDetail?.revenueStats?.map((row) => ({
      id: `${row.parentCategory ?? "none"}-${row.revenueCategory ?? "unknown"}`,
      cells: [row.parentCategory, row.revenueCategory, money(row.amount)],
    })) ?? [];
  const paymentRows =
    auditDetail?.paymentTypeStats?.map((row) => ({
      id: row.paymentType ?? "unknown-payment",
      cells: [row.paymentType, money(row.amount)],
    })) ?? [];
  const competitionRows =
    auditDetail?.competitionStats?.map((row) => ({
      id: row.competitor ?? "unknown-competitor",
      cells: [row.competitor, money(row.rate), numberText(row.occupiedRooms)],
    })) ?? [];

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-semibold text-2xl">Revenue Review</h1>
            <p className="text-muted-foreground text-sm">
              Canonical audit, pace, budget, and competitor data
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Property</span>
              <select
                className="h-9 rounded-md border bg-background px-3"
                onChange={(event) =>
                  setSelectedCompanyId(Number(event.target.value))
                }
                value={selectedCompanyId ?? ""}
              >
                {companies.map((company) => (
                  <option
                    key={company.legacyCompanyId}
                    value={company.legacyCompanyId}
                  >
                    {company.name ?? `Legacy ${company.legacyCompanyId}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Audit date</span>
              <select
                className="h-9 rounded-md border bg-background px-3"
                onChange={(event) =>
                  setSelectedAuditId(Number(event.target.value))
                }
                value={selectedAuditId ?? ""}
              >
                {validAudits.map((audit) => (
                  <option
                    key={audit.legacyAuditId ?? audit.date}
                    value={audit.legacyAuditId ?? ""}
                  >
                    {audit.date}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Building2}
            label="Rooms"
            value={numberText(selectedCompany?.totalRooms)}
          />
          <MetricCard
            icon={CalendarDays}
            label="Audit"
            value={auditDetail?.audit?.date ?? "—"}
          />
          <MetricCard
            icon={Activity}
            label="Projected Rooms"
            value={numberText(forecast?.summary?.projectedRooms)}
          />
          <MetricCard
            icon={CircleDollarSign}
            label="Projected Revenue"
            value={money(forecast?.summary?.projectedRevenue)}
          />
        </div>

        <ForecastChart forecast={forecast} />

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Room Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={["Metric", "Value"]} rows={roomRows} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={["Parent", "Category", "Amount"]}
                rows={revenueRows}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={["Type", "Amount"]} rows={paymentRows} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Competition</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={["Competitor", "Rate", "Occupied Rooms"]}
                rows={competitionRows}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
