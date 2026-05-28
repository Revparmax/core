export const inspectorHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RevParMax Pace Forecast</title>
    <style>
      :root {
        color-scheme: light;
        --background: #f8fafc;
        --foreground: #0f172a;
        --card: #ffffff;
        --card-foreground: #0f172a;
        --muted: #f1f5f9;
        --muted-foreground: #64748b;
        --border: #e2e8f0;
        --input: #cbd5e1;
        --primary: #0f172a;
        --primary-foreground: #ffffff;
        --accent: #0e7490;
        --green: #15803d;
        --yellow: #a16207;
        --red: #b91c1c;
        --ring: #2563eb;
        --radius: 8px;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--background);
        color: var(--foreground);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      button,
      input,
      select {
        font: inherit;
      }

      .page {
        width: min(1440px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 24px 0 36px;
      }

      .topbar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 18px;
      }

      h1 {
        margin: 0;
        font-size: 28px;
        letter-spacing: 0;
        line-height: 1.1;
      }

      .muted {
        color: var(--muted-foreground);
      }

      .controls {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) 180px 180px auto;
        gap: 12px;
        align-items: end;
        margin-bottom: 16px;
      }

      .field {
        display: grid;
        gap: 6px;
      }

      .label {
        color: var(--muted-foreground);
        font-size: 13px;
        font-weight: 650;
      }

      .input,
      .select,
      .button {
        min-height: 42px;
        border-radius: 6px;
        border: 1px solid var(--input);
      }

      .input,
      .select {
        width: 100%;
        background: var(--card);
        color: var(--foreground);
        padding: 0 12px;
      }

      .input:focus,
      .select:focus,
      .button:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--primary);
        color: var(--primary-foreground);
        cursor: pointer;
        font-weight: 700;
        padding: 0 16px;
      }

      .button:disabled {
        cursor: wait;
        opacity: 0.62;
      }

      .grid {
        display: grid;
        gap: 12px;
      }

      .summary-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
        margin-bottom: 16px;
      }

      .detail-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin-bottom: 16px;
      }

      .card {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--card);
        color: var(--card-foreground);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 16px 0;
      }

      .card-title {
        font-size: 18px;
        font-weight: 750;
      }

      .card-body {
        padding: 16px;
      }

      .metric {
        padding: 14px;
      }

      .metric.primary {
        border-color: rgba(14, 116, 144, 0.32);
        background: linear-gradient(180deg, #ffffff 0%, #ecfeff 100%);
      }

      .metric-label {
        color: var(--muted-foreground);
        font-size: 12px;
        font-weight: 720;
        text-transform: uppercase;
      }

      .metric-value {
        margin-top: 6px;
        font-size: 27px;
        font-weight: 780;
        line-height: 1.1;
      }

      .metric-note {
        margin-top: 6px;
        color: var(--muted-foreground);
        font-size: 12px;
      }

      .chart {
        height: 390px;
      }

      .table-wrap {
        overflow: auto;
      }

      table {
        width: 100%;
        min-width: 1120px;
        border-collapse: collapse;
      }

      th,
      td {
        border-bottom: 1px solid var(--border);
        padding: 11px 12px;
        text-align: right;
        white-space: nowrap;
      }

      th {
        background: var(--muted);
        color: var(--muted-foreground);
        font-size: 12px;
        text-transform: uppercase;
      }

      th:first-child,
      td:first-child {
        text-align: left;
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .badge {
        display: inline-flex;
        min-width: 78px;
        justify-content: center;
        border-radius: 999px;
        padding: 3px 9px;
        color: #ffffff;
        font-size: 12px;
        font-weight: 750;
      }

      .green {
        background: var(--green);
      }

      .yellow {
        background: var(--yellow);
      }

      .red {
        background: var(--red);
      }

      .unavailable {
        background: #64748b;
      }

      .message {
        padding: 18px;
        color: var(--muted-foreground);
      }

      @media (max-width: 980px) {
        .topbar {
          flex-direction: column;
        }

        .controls,
        .summary-grid,
        .detail-grid {
          grid-template-columns: 1fr;
        }

        .button {
          width: 100%;
        }
      }
    </style>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@18.3.1",
          "react-dom": "https://esm.sh/react-dom@18.3.1",
          "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
          "recharts": "https://esm.sh/recharts@2.12.7?external=react,react-dom"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import React, { useEffect, useMemo, useState } from "react";
      import { createRoot } from "react-dom/client";
      import {
        Bar,
        CartesianGrid,
        ComposedChart,
        Legend,
        Line,
        ReferenceLine,
        ResponsiveContainer,
        Tooltip,
        XAxis,
        YAxis
      } from "recharts";

      const h = React.createElement;
      const money = new Intl.NumberFormat("en-US", {
        currency: "USD",
        maximumFractionDigits: 0,
        style: "currency"
      });
      const number = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 1
      });
      const percent = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1
      });

      const fetchJson = async (path) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(path + " returned " + response.status);
        }
        return await response.json();
      };

      const formatNumber = (value) =>
        value === null || value === undefined ? "Unavailable" : number.format(value);

      const formatMoney = (value) =>
        value === null || value === undefined ? "Unavailable" : money.format(value);

      const formatPercent = (value) =>
        value === null || value === undefined ? "Unavailable" : percent.format(value) + "%";

      const sum = (rows, key) =>
        rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] : 0), 0);

      const cn = (...values) => values.filter(Boolean).join(" ");

      const MetricCard = ({ label, value, note, primary }) =>
        h(
          "section",
          { className: cn("card metric", primary && "primary") },
          h("div", { className: "metric-label" }, label),
          h("div", { className: "metric-value" }, value),
          note ? h("div", { className: "metric-note" }, note) : null
        );

      const Field = ({ children, label }) =>
        h("label", { className: "field" }, h("span", { className: "label" }, label), children);

      const StatusBadge = ({ status }) =>
        h("span", { className: cn("badge", status || "unavailable") }, status || "unavailable");

      const ForecastChart = ({ rows }) => {
        const data = rows.map((row) => ({
          current: row.tyRooms,
          date: row.date.slice(5),
          forecast: row.forecastRooms,
          lyPickup: row.lyPickup,
          net: row.paceNet,
          paceLy: row.lyPaceRooms,
          paceTy: row.tyPaceRooms
        }));

        return h(
          "section",
          { className: "card" },
          h(
            "div",
            { className: "card-header" },
            h("div", { className: "card-title" }, "Pace And Forecast"),
            h("div", { className: "muted" }, "Recharts")
          ),
          h(
            "div",
            { className: "card-body chart" },
            h(
              ResponsiveContainer,
              { height: "100%", width: "100%" },
              h(
                ComposedChart,
                { data, margin: { bottom: 10, left: 8, right: 14, top: 10 } },
                h(CartesianGrid, { stroke: "#e2e8f0", vertical: false }),
                h(XAxis, { dataKey: "date", stroke: "#64748b" }),
                h(YAxis, { stroke: "#64748b" }),
                h(Tooltip, {
                  formatter: (value, name) => [formatNumber(value), name],
                  labelFormatter: (label) => "Date " + label
                }),
                h(Legend, {}),
                h(ReferenceLine, { stroke: "#94a3b8", y: 0 }),
                h(Bar, { dataKey: "net", fill: "#f59e0b", name: "Pace net", radius: [4, 4, 0, 0] }),
                h(Line, { dataKey: "current", dot: false, name: "Current rooms", stroke: "#0e7490", strokeWidth: 3, type: "monotone" }),
                h(Line, { dataKey: "forecast", dot: false, name: "Forecast rooms", stroke: "#334155", strokeWidth: 3, type: "monotone" }),
                h(Line, { dataKey: "lyPickup", dot: false, name: "LY pickup", stroke: "#16a34a", strokeDasharray: "5 5", strokeWidth: 2, type: "monotone" })
              )
            )
          )
        );
      };

      const ForecastTable = ({ rows }) => {
        if (rows.length === 0) {
          return h("section", { className: "card message" }, "No forecast rows available.");
        }

        return h(
          "section",
          { className: "card table-wrap" },
          h(
            "table",
            {},
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                h("th", {}, "Date"),
                h("th", {}, "Pace TY"),
                h("th", {}, "Pace LY"),
                h("th", {}, "Net"),
                h("th", {}, "Current"),
                h("th", {}, "LY Pickup"),
                h("th", {}, "Forecast"),
                h("th", {}, "TY ADR"),
                h("th", {}, "Projected Revenue"),
                h("th", {}, "Status"),
                h("th", {}, "Warnings")
              )
            ),
            h(
              "tbody",
              {},
              rows.map((row) =>
                h(
                  "tr",
                  { key: row.date },
                  h("td", {}, row.date),
                  h("td", {}, formatNumber(row.tyPaceRooms)),
                  h("td", {}, formatNumber(row.lyPaceRooms)),
                  h("td", {}, formatNumber(row.paceNet)),
                  h("td", {}, formatNumber(row.tyRooms)),
                  h("td", {}, formatNumber(row.lyPickup)),
                  h("td", {}, formatNumber(row.forecastRooms)),
                  h("td", {}, formatMoney(row.tyAdr)),
                  h("td", {}, formatMoney(row.projectedRevenue)),
                  h("td", {}, h(StatusBadge, { status: row.colorStatus })),
                  h("td", {}, (row.warnings || []).join(", ") || "None")
                )
              )
            )
          )
        );
      };

      const App = () => {
        const [companies, setCompanies] = useState([]);
        const [propertyId, setPropertyId] = useState("");
        const [asOf, setAsOf] = useState("2026-05-22");
        const [month, setMonth] = useState("2026-05");
        const [forecast, setForecast] = useState(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState("");

        const selectedCompany = useMemo(
          () => companies.find((company) => company.propertyId === propertyId),
          [companies, propertyId]
        );

        const loadForecast = async (nextPropertyId, nextAsOf, nextMonth) => {
          if (!nextPropertyId) {
            return;
          }
          setLoading(true);
          setError("");
          try {
            const path =
              "/properties/" +
              encodeURIComponent(nextPropertyId) +
              "/forecast/month?asOf=" +
              encodeURIComponent(nextAsOf) +
              "&month=" +
              encodeURIComponent(nextMonth);
            setForecast(await fetchJson(path));
          } catch (caught) {
            setForecast(null);
            setError(caught instanceof Error ? caught.message : "Failed to load forecast.");
          } finally {
            setLoading(false);
          }
        };

        useEffect(() => {
          fetchJson("/companies")
            .then((items) => {
              const available = items.filter((company) => company.propertyId);
              setCompanies(available);
              const preferred = available.find((company) => company.legacyCompanyId === 103) || available[0];
              if (preferred) {
                setPropertyId(preferred.propertyId);
                void loadForecast(preferred.propertyId, asOf, month);
              }
            })
            .catch((caught) => {
              setError(caught instanceof Error ? caught.message : "Failed to load companies.");
            });
        }, []);

        const rows = forecast?.rows || [];
        const summary = forecast?.summary || {};
        const futureCurrentRooms = sum(rows, "tyRooms");
        const futureForecastRooms = sum(rows, "forecastRooms");
        const futureLyPickup = sum(rows, "lyPickup");
        const futurePaceNet = sum(rows, "paceNet");

        return h(
          "main",
          { className: "page" },
          h(
            "div",
            { className: "topbar" },
            h(
              "div",
              {},
              h("h1", {}, "Pace Forecast Inspector"),
              h("div", { className: "muted" }, "Canonical daily buckets with 52-week LY overlay")
            ),
            h(
              "div",
              { className: "muted" },
              selectedCompany
                ? selectedCompany.name + " · legacy " + selectedCompany.legacyCompanyId
                : "Loading bridge data"
            )
          ),
          h(
            "form",
            {
              className: "controls",
              onSubmit: (event) => {
                event.preventDefault();
                void loadForecast(propertyId, asOf, month);
              }
            },
            h(
              Field,
              { label: "Property" },
              h(
                "select",
                {
                  className: "select",
                  onChange: (event) => setPropertyId(event.target.value),
                  value: propertyId
                },
                companies.map((company) =>
                  h(
                    "option",
                    { key: company.propertyId, value: company.propertyId },
                    company.name + " · legacy " + company.legacyCompanyId
                  )
                )
              )
            ),
            h(
              Field,
              { label: "As of" },
              h("input", {
                className: "input",
                onChange: (event) => setAsOf(event.target.value),
                type: "date",
                value: asOf
              })
            ),
            h(
              Field,
              { label: "Month" },
              h("input", {
                className: "input",
                onChange: (event) => setMonth(event.target.value),
                type: "month",
                value: month
              })
            ),
            h("button", { className: "button", disabled: loading, type: "submit" }, loading ? "Refreshing" : "Refresh")
          ),
          error ? h("section", { className: "card message" }, error) : null,
          h(
            "div",
            { className: "grid summary-grid" },
            h(MetricCard, { label: "Projected Revenue", primary: true, value: formatMoney(summary.projectedRevenue) }),
            h(MetricCard, { label: "Projected Occupancy", primary: true, value: formatPercent(summary.projectedOccupancy) }),
            h(MetricCard, { label: "Projected RevPAR", primary: true, value: formatMoney(summary.projectedRevpar) }),
            h(MetricCard, { label: "Projected ADR", primary: true, value: formatMoney(summary.projectedAdr) }),
            h(MetricCard, { label: "Projected Rooms", note: "Full month", primary: true, value: formatNumber(summary.projectedRooms) })
          ),
          h(
            "div",
            { className: "grid detail-grid" },
            h(MetricCard, { label: "Future Current Rooms", value: formatNumber(futureCurrentRooms) }),
            h(MetricCard, { label: "Future Forecast Rooms", value: formatNumber(futureForecastRooms) }),
            h(MetricCard, { label: "Future LY Pickup", value: formatNumber(futureLyPickup) }),
            h(MetricCard, { label: "Future Pace Net", value: formatNumber(futurePaceNet) })
          ),
          h(ForecastChart, { rows }),
          h("div", { style: { height: 16 } }),
          h(ForecastTable, { rows })
        );
      };

      createRoot(document.getElementById("root")).render(h(App));
    </script>
  </body>
</html>`;
