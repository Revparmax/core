import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  ExternalLink,
  Search,
  Sparkles,
} from "lucide-react";
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

export const Route = createFileRoute("/brand")({
  component: BrandRoute,
  head: () => ({
    meta: [{ title: "RevPARMAX — Brand Kit 2026" }],
  }),
});

const FORECAST: ForecastPoint[] = [
  { month: "Jan", actual: 412_000, forecast: null },
  { month: "Feb", actual: 438_000, forecast: null },
  { month: "Mar", actual: 465_000, forecast: null },
  { month: "Apr", actual: 472_000, forecast: null },
  { month: "May", actual: 498_000, forecast: null },
  { month: "Jun", actual: 521_000, forecast: null },
  { month: "Jul", actual: 554_000, forecast: null },
  // Aug = join point: carries the actual AND seeds the forecast/band so the
  // dashed forecast line is continuous with the solid actuals line.
  {
    month: "Aug",
    actual: 568_000,
    forecast: 568_000,
    band: [568_000, 568_000],
  },
  { month: "Sep", actual: null, forecast: 582_000, band: [560_000, 604_000] },
  { month: "Oct", actual: null, forecast: 612_000, band: [578_000, 646_000] },
  { month: "Nov", actual: null, forecast: 638_000, band: [592_000, 684_000] },
  { month: "Dec", actual: null, forecast: 671_000, band: [605_000, 737_000] },
];

function BrandRoute() {
  return (
    <div className="min-h-svh bg-[#ECEAE3] text-[#1B1B19] dark:bg-background dark:text-foreground">
      <main className="mx-auto w-full max-w-[1180px] px-[clamp(20px,4vw,52px)] pt-[clamp(20px,4vw,52px)] pb-32">
        <TopBar />
        <Cover />
        <LogoSection />
        <ColorSection />
        <TypographySection />
        <GeometrySection />
        <PatternSection />
        <ComponentsSection />
        <SystemInActionSection />
        <PageFooter />
      </main>
    </div>
  );
}

/* ============================================================
   Top metadata bar
   ============================================================ */
function TopBar() {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-6 border-[#D8D5CD] border-b pb-4 dark:border-border">
      <div className="font-mono text-[#6F6D66] text-[12px] uppercase tracking-[0.18em] dark:text-mid">
        RevPARMAX · Brand Kit · v1.0 · 2026
      </div>
      <div className="flex items-center gap-4">
        <a
          className="inline-flex items-center gap-1.5 font-mono text-[#6F6D66] text-[11px] uppercase tracking-[0.16em] hover:text-primary dark:text-mid"
          href="/component-library/index.html"
          rel="noopener"
          target="_blank"
        >
          Full component library
          <ExternalLink className="size-3" />
        </a>
        <a
          className="inline-flex items-center gap-1.5 font-mono text-[#6F6D66] text-[11px] uppercase tracking-[0.16em] hover:text-primary dark:text-mid"
          href="/design.md"
        >
          design.md
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   Cover
   ============================================================ */
function Cover() {
  return (
    <section className="relative overflow-hidden py-[clamp(40px,8vw,96px)]">
      <CoverGradient />
      <div className="relative">
        <div className="font-mono text-[#6F6D66] text-[12px] uppercase tracking-[0.2em] dark:text-mid">
          Brand Kit · Identity, Tokens, Components
        </div>
        <h1 className="mt-7 font-display font-medium text-[clamp(40px,8vw,92px)] leading-[0.98] tracking-[-0.04em]">
          RevPAR<span className="text-primary">MAX</span>
        </h1>
        <p className="mt-7 max-w-[56ch] text-[#45433d] text-[18px] leading-relaxed dark:text-mid">
          A revenue command center for hospitality operators. Calm by default;
          ember is the single beacon that signals movement, focus, and live
          state. Warm neutrals do the work, and numbers stay in monotype so the
          ledger always lines up.
        </p>
        <div className="mt-9 flex flex-wrap gap-7 font-mono text-[#6F6D66] text-[12px] uppercase tracking-[0.04em] dark:text-mid">
          <span>
            Version{" "}
            <b className="font-semibold text-[#1B1B19] dark:text-foreground">
              1.0
            </b>
          </span>
          <span>
            Issued{" "}
            <b className="font-semibold text-[#1B1B19] dark:text-foreground">
              2026 · Q2
            </b>
          </span>
          <span>
            Owners{" "}
            <b className="font-semibold text-[#1B1B19] dark:text-foreground">
              Design Systems
            </b>
          </span>
        </div>
      </div>
    </section>
  );
}

function CoverGradient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 70% 80% at 100% -10%, rgb(255 90 44 / 0.22) 0%, rgb(255 90 44 / 0.1) 20%, rgb(255 90 44 / 0.03) 45%, transparent 70%)",
      }}
    />
  );
}

/* ============================================================
   Section primitive
   ============================================================ */
function Section({
  num,
  title,
  subtitle,
  children,
}: {
  num: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-[clamp(56px,9vw,104px)]">
      <div className="mb-2 flex flex-wrap items-baseline gap-4">
        <span className="font-mono text-[#6F6D66] text-[12px] tracking-[0.16em] dark:text-mid">
          {num}
        </span>
        <h2 className="font-display font-semibold text-[clamp(24px,3.4vw,38px)] tracking-[-0.025em]">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="mb-8 max-w-[64ch] text-[#5e5c55] text-[16px] leading-[1.55] dark:text-mid">
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mb-8" />}
      {children}
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 font-mono text-[#6F6D66] text-[11px] uppercase tracking-[0.18em] dark:text-mid">
      <span>{children}</span>
      <span className="h-px flex-1 bg-[#D8D5CD] dark:bg-border" />
    </div>
  );
}

/* ============================================================
   01 · Logo
   ============================================================ */
function LogoSection() {
  return (
    <Section
      num="01"
      subtitle="A geometric rounded-square mark with an ascending peak, anchored by an ember dot at the apex — quiet, architectural, instrument-grade."
      title="Logo"
    >
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-[1.3fr_1fr]">
        <LogoCell tone="light">
          <Lockup color="#1A1714" />
        </LogoCell>
        <LogoCell tone="dark">
          <Lockup color="#F3F2EE" />
        </LogoCell>
      </div>
      <div className="mt-[18px] grid grid-cols-2 gap-[18px] md:grid-cols-4">
        <LogoCell compact tone="light">
          <Mark color="#1A1714" size={48} />
          <span className="font-mono text-[#6F6D66] text-[10.5px] uppercase tracking-[0.08em] dark:text-mid">
            Mark · Ink
          </span>
        </LogoCell>
        <LogoCell compact tone="ember">
          <Mark color="#FFFFFF" embers="white" size={48} />
          <span className="font-mono text-[10.5px] text-white/70 uppercase tracking-[0.08em]">
            Mark · Reverse
          </span>
        </LogoCell>
        <LogoCell compact tone="dark">
          <Mark color="#F3F2EE" size={48} />
          <span className="font-mono text-[10.5px] text-white/60 uppercase tracking-[0.08em]">
            Mark · Dark
          </span>
        </LogoCell>
        <LogoCell compact tone="light">
          <div className="flex items-end gap-3">
            <Mark color="#1A1714" radius={11} size={48} />
            <Mark color="#1A1714" radius={8} size={32} />
            <Mark color="#1A1714" radius={6} size={20} />
          </div>
          <span className="font-mono text-[#6F6D66] text-[10.5px] uppercase tracking-[0.08em] dark:text-mid">
            Favicons
          </span>
        </LogoCell>
      </div>
    </Section>
  );
}

function LogoCell({
  tone,
  compact,
  children,
}: {
  tone: "light" | "dark" | "ember";
  compact?: boolean;
  children: React.ReactNode;
}) {
  const base =
    "relative flex flex-col items-center justify-center overflow-hidden rounded-[22px]";
  const padding = compact ? "min-h-[128px] gap-3 p-6" : "min-h-[200px] p-11";
  // Brand-kit cells lock to their intended tone regardless of app theme.
  const toneCls = {
    light: "border border-[#E7E1D5] bg-[#FFFDF9] text-[#1A1714]",
    dark: "border border-white/10 bg-[#111210] text-[#F3F2EE]",
    ember: "bg-[#FF5A2C] text-white",
  }[tone];
  return (
    <div className={`${base} ${padding} ${toneCls}`}>
      {tone === "ember" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgb(255 255 255 / 0.35), transparent 50%)",
          }}
        />
      )}
      {children}
    </div>
  );
}

function Lockup({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-4">
      <Mark color={color} size={64} />
      <span
        className="font-display font-semibold text-[clamp(22px,3vw,34px)] tracking-[-0.02em]"
        style={{ color }}
      >
        RevPAR
        <span className="font-normal text-primary tracking-[0.01em]">MAX</span>
      </span>
    </div>
  );
}

function Mark({
  size = 48,
  color = "#1A1714",
  radius,
  embers = "ember",
}: {
  size?: number;
  color?: string;
  radius?: number;
  embers?: "ember" | "white";
}) {
  const rx = radius ?? Math.round(size * 0.27);
  const stroke = Math.max(2, Math.round(size * 0.075));
  const peakStroke = Math.max(2, Math.round(size * 0.09));
  return (
    <svg
      aria-hidden
      fill="none"
      height={size}
      role="img"
      viewBox="0 0 100 100"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>RevPARMAX mark</title>
      <rect
        height={84}
        rx={(rx * 84) / size}
        stroke={color}
        strokeWidth={stroke}
        width={84}
        x={8}
        y={8}
      />
      <path
        d="M27 70 L50 33 L73 70"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={peakStroke}
      />
      <circle
        cx={50}
        cy={33}
        fill={embers === "white" ? "#FFFFFF" : "#FF5A2C"}
        r={6.5}
      />
    </svg>
  );
}

/* ============================================================
   02 · Color
   ============================================================ */
function ColorSection() {
  const corePalette = [
    {
      name: "Ember",
      token: "--primary",
      hex: "#FF5A2C",
      role: "Live signal, focal metric, primary action",
      cls: "bg-[#FF5A2C] text-white",
    },
    {
      name: "Ember Deep",
      token: "--acc-deep",
      hex: "#DF440F",
      role: "Text on light, hover-deepen state",
      cls: "bg-[#DF440F] text-white",
    },
    {
      name: "Paper",
      token: "--background",
      hex: "#F4F2EC",
      role: "Page canvas — never pure white",
      cls: "bg-[#F4F2EC] text-[#1A1714] border border-[#E7E1D5]",
    },
    {
      name: "Surface",
      token: "--card",
      hex: "#FFFDF9",
      role: "Card / panel base in light",
      cls: "bg-[#FFFDF9] text-[#1A1714] border border-[#E7E1D5]",
    },
    {
      name: "Ink",
      token: "--foreground",
      hex: "#1A1714",
      role: "Primary text & icons (light)",
      cls: "bg-[#1A1714] text-white",
    },
    {
      name: "Charcoal",
      token: "--background (dark)",
      hex: "#0F100E",
      role: "Page canvas (dark)",
      cls: "bg-[#0F100E] text-[#F3F2EE]",
    },
  ];

  const functionalPalette = [
    {
      name: "Positive",
      token: "--pos",
      hex: "#2E9E68",
      cls: "bg-[#2E9E68] text-white",
    },
    {
      name: "Negative",
      token: "--neg",
      hex: "#D8453B",
      cls: "bg-[#D8453B] text-white",
    },
    {
      name: "Mid",
      token: "--mid",
      hex: "#7D756A",
      cls: "bg-[#7D756A] text-white",
    },
    {
      name: "Low",
      token: "--low",
      hex: "#A79E91",
      cls: "bg-[#A79E91] text-white",
    },
    {
      name: "Border",
      token: "--border",
      hex: "#E7E1D5",
      cls: "bg-[#E7E1D5] text-[#1A1714]",
    },
    {
      name: "Bar",
      token: "--bar",
      hex: "#DDD8CD",
      cls: "bg-[#DDD8CD] text-[#1A1714]",
    },
  ];

  const emberRamp = [
    { stop: "50", hex: "#FFEDE6", cls: "bg-[#FFEDE6] text-[#DF440F]" },
    { stop: "200", hex: "#FFC3AD", cls: "bg-[#FFC3AD] text-[#A8330B]" },
    { stop: "400", hex: "#FF7E54", cls: "bg-[#FF7E54] text-white" },
    { stop: "500", hex: "#FF5A2C", cls: "bg-[#FF5A2C] text-white" },
    { stop: "600", hex: "#DF440F", cls: "bg-[#DF440F] text-white" },
    { stop: "800", hex: "#A8330B", cls: "bg-[#A8330B] text-white" },
  ];

  return (
    <Section
      num="02"
      subtitle="Warm neutrals carry ~95% of the surface. Ember is the single brand accent — used for live signal, the focal metric, and the primary action. Functional green / red are bound strictly to directional data so ember always wins the eye."
      title="Color"
    >
      <SubLabel>Core palette</SubLabel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {corePalette.map((sw) => (
          <Swatch key={sw.name} {...sw} />
        ))}
      </div>

      <div className="mt-12">
        <SubLabel>Functional</SubLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {functionalPalette.map((sw) => (
            <Swatch key={sw.name} {...sw} />
          ))}
        </div>
      </div>

      <div className="mt-12">
        <SubLabel>Ember scale</SubLabel>
        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-[#D8D5CD] md:grid-cols-6 dark:border-border">
          {emberRamp.map((s) => (
            <div className={`flex h-24 items-end p-3 ${s.cls}`} key={s.stop}>
              <div>
                <div className="font-mono text-[10px]">ember-{s.stop}</div>
                <div className="font-mono text-[10px] uppercase opacity-80">
                  {s.hex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Swatch({
  name,
  token,
  hex,
  role,
  cls,
}: {
  name: string;
  token: string;
  hex: string;
  role?: string;
  cls: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#D8D5CD] bg-[#FFFDF9] dark:border-border dark:bg-card">
      <div className={`h-[74px] ${cls}`} />
      <div className="px-3 py-2.5">
        <div className="font-semibold text-xs">{name}</div>
        <div className="mt-0.5 font-mono text-[#6F6D66] text-[10px] dark:text-mid">
          {token}
        </div>
        <div className="font-mono text-[#6F6D66] text-[10px] uppercase dark:text-mid">
          {hex}
        </div>
        {role && (
          <div className="mt-1.5 text-[#6F6D66] text-[11px] leading-tight dark:text-mid">
            {role}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   03 · Typography
   ============================================================ */
function TypographySection() {
  const scale = [
    {
      token: "display-xl",
      meta: "Space Grotesk · 500 · clamp(40,8vw,92)",
      sample: "Revenue clarity",
      cls: "font-display font-medium text-5xl tracking-[-0.04em]",
    },
    {
      token: "display-lg",
      meta: "Space Grotesk · 600 · 38px",
      sample: "Section heading",
      cls: "font-display font-semibold text-[38px] tracking-[-0.025em]",
    },
    {
      token: "display-md",
      meta: "Space Grotesk · 600 · 24px",
      sample: "Card title",
      cls: "font-display font-semibold text-2xl tracking-tight",
    },
    {
      token: "body-md",
      meta: "Hanken Grotesk · 400 · 16px",
      sample: "The interface stays quiet so the numbers can speak.",
      cls: "text-base",
    },
    {
      token: "body-sm",
      meta: "Hanken Grotesk · 400 · 14px",
      sample: "Supporting copy and dense UI text.",
      cls: "text-sm",
    },
    {
      token: "label-mono",
      meta: "IBM Plex Mono · 500 · 11px · tracked",
      sample: "REVPAR · OCC · ADR · 11/22",
      cls: "font-mono text-[11px] uppercase tracking-[0.18em]",
    },
    {
      token: "numeric-display",
      meta: "IBM Plex Mono · 600 · 28px · tnum",
      sample: "$1,847,200",
      cls: "font-mono font-semibold text-[28px] tnum",
    },
  ];

  return (
    <Section
      num="03"
      subtitle="Three families, three roles, no overlap. Space Grotesk for display moments. Hanken Grotesk for everything you read. IBM Plex Mono for every number — figures line up like a ledger."
      title="Typography"
    >
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
        <Family
          glyphs="A a 1 2 — & @"
          name="Space Grotesk"
          preview="Aa"
          previewClass="font-display"
          usage="Display · 500 / 600"
        />
        <Family
          glyphs="A a 1 2 — & @"
          name="Hanken Grotesk"
          preview="Aa"
          previewClass="font-sans"
          usage="Body · 400 → 800"
        />
        <Family
          glyphs="0 1 2 3 4 5 6 7 8 9 . , $"
          name="IBM Plex Mono"
          preview="123"
          previewClass="font-mono"
          usage="Numeric · 400 / 500 / 600"
        />
      </div>

      <div className="mt-10 overflow-hidden rounded-[16px] border border-[#E7E1D5] bg-[#FFFDF9] dark:border-border dark:bg-card">
        {scale.map((s, i) => (
          <div
            className={`grid grid-cols-[160px_1fr] items-baseline gap-5 px-6 py-5 ${i > 0 ? "border-[#E7E1D5] border-t dark:border-border" : ""}`}
            key={s.token}
          >
            <div>
              <div className="font-semibold text-[12px]">{s.token}</div>
              <div className="mt-1 font-mono text-[#6F6D66] text-[10px] dark:text-mid">
                {s.meta}
              </div>
            </div>
            <div className={s.cls}>{s.sample}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Family({
  name,
  usage,
  preview,
  previewClass,
  glyphs,
}: {
  name: string;
  usage: string;
  preview: string;
  previewClass: string;
  glyphs: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#E7E1D5] bg-[#FFFDF9] p-6 dark:border-border dark:bg-card">
      <div className={`mb-3.5 text-[46px] leading-none ${previewClass}`}>
        {preview}
      </div>
      <div className="font-semibold text-[15px]">{name}</div>
      <div className="mt-0.5 font-mono text-[#6F6D66] text-[11px] tracking-[0.06em] dark:text-mid">
        {usage}
      </div>
      <div className="mt-3 text-[#6F6D66] text-[13px] tracking-[0.02em] dark:text-mid">
        {glyphs}
      </div>
    </div>
  );
}

/* ============================================================
   04 · Spacing & geometry
   ============================================================ */
function GeometrySection() {
  const steps = [
    { token: "1", px: 4 },
    { token: "2", px: 8 },
    { token: "3", px: 12 },
    { token: "4", px: 16 },
    { token: "5", px: 20 },
    { token: "6", px: 24 },
    { token: "8", px: 32 },
    { token: "10", px: 40 },
    { token: "14", px: 56 },
    { token: "18", px: 72 },
  ];
  const radii = [
    { token: "sm", px: 8 },
    { token: "md", px: 12 },
    { token: "lg", px: 16 },
    { token: "xl", px: 22 },
    { token: "pill", px: 9999, label: "pill" },
  ];
  const elevations = [
    {
      label: "01 · ambient",
      style: "0 1px 2px rgb(26 23 20 / 0.04)",
    },
    {
      label: "02 · card",
      style:
        "0 1px 2px rgb(26 23 20 / 0.04), 0 18px 40px -28px rgb(26 23 20 / 0.28)",
    },
    {
      label: "03 · overlay",
      style:
        "0 1px 2px rgb(26 23 20 / 0.04), 0 30px 60px -24px rgb(26 23 20 / 0.4)",
    },
  ];

  return (
    <Section
      num="04"
      subtitle="Strict 4-pixel grid. Five radii: sm controls, md menus, lg cards, xl layout boundaries, pill for status. Depth is structural — one soft warm shadow in light; thin borders + localized ember glow in dark."
      title="Spacing & geometry"
    >
      <SubLabel>Spacing scale · base 4</SubLabel>
      <div className="flex flex-wrap items-end gap-3.5">
        {steps.map((s) => (
          <div className="flex flex-col items-center gap-2" key={s.token}>
            <div
              className="border border-primary"
              style={{
                width: s.px,
                height: s.px,
                backgroundColor: "rgb(255 90 44 / 0.12)",
              }}
            />
            <span className="font-mono text-[#6F6D66] text-[10px] dark:text-mid">
              s{s.token} · {s.px}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <SubLabel>Radius</SubLabel>
        <div className="flex flex-wrap gap-4">
          {radii.map((r) => (
            <div
              className="flex h-[88px] w-[88px] items-end justify-center border border-[#D8D5CD] bg-[#FFFDF9] p-2 dark:border-border dark:bg-card"
              key={r.token}
              style={{ borderRadius: r.px === 9999 ? 9999 : r.px }}
            >
              <span className="font-mono text-[#6F6D66] text-[10px] dark:text-mid">
                {r.label ?? r.token} · {r.px === 9999 ? "∞" : `${r.px}px`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <SubLabel>Elevation</SubLabel>
        <div className="flex flex-wrap gap-5">
          {elevations.map((e) => (
            <div
              className="flex h-24 w-[150px] items-end rounded-[16px] bg-white p-2.5 font-mono text-[#6F6D66] text-[10px]"
              key={e.label}
              style={{ boxShadow: e.style }}
            >
              {e.label}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ============================================================
   05 · Patterns & gradients
   ============================================================ */
function PatternSection() {
  return (
    <Section
      num="05"
      subtitle="Patterns and gradients are spent like the accent — used sparingly to add atmosphere to hero surfaces and live signals. Always fade them toward margins; never edge-to-edge."
      title="Patterns & gradients"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PatternTile label="Ember radial · cover">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 75% 20%, rgb(255 90 44 / 0.35), rgb(255 90 44 / 0.08) 35%, transparent 65%)",
            }}
          />
        </PatternTile>
        <PatternTile label="Ember wash · card glow">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(460px 240px at 82% -12%, rgb(255 90 44 / 0.2), transparent 60%)",
              backgroundColor: "#FFFDF9",
            }}
          />
        </PatternTile>
        <PatternTile dark label="Dark ember halo">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(380px 200px at 50% 110%, rgb(255 90 44 / 0.3), transparent 60%)",
              backgroundColor: "#0F100E",
            }}
          />
        </PatternTile>
        <PatternTile label="Grid · clearspace">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgb(255 90 44 / 0.18) 1px, transparent 1px), linear-gradient(90deg, rgb(255 90 44 / 0.18) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              backgroundColor: "#FFFDF9",
            }}
          />
        </PatternTile>
        <PatternTile label="Dot field · density">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(rgb(255 90 44 / 0.32) 1.2px, transparent 1.5px)",
              backgroundSize: "16px 16px",
              backgroundColor: "#FBF8F1",
            }}
          />
        </PatternTile>
        <PatternTile dark label="Compression · diagonals">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgb(255 90 44 / 0.16) 0 2px, transparent 2px 14px)",
              backgroundColor: "#0F100E",
            }}
          />
        </PatternTile>
        <PatternTile label="Halftone · fade">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "#FBF8F1" }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(rgb(255 90 44 / 0.55) 1.6px, transparent 2px)",
              backgroundSize: "13px 13px",
              maskImage:
                "radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, black 30%, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, black 30%, transparent 80%)",
            }}
          />
        </PatternTile>
        <PatternTile label="Flowing ribbons">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "#FBF8F1" }}
          />
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox="0 0 400 172"
          >
            <title>Flowing ribbons pattern</title>
            <path
              d="M-20 80 C 80 30, 180 130, 260 80 S 420 90, 480 70"
              fill="none"
              stroke="#FF5A2C"
              strokeLinecap="round"
              strokeWidth={3}
            />
            <path
              d="M-20 100 C 80 50, 180 150, 260 100 S 420 110, 480 90"
              fill="none"
              stroke="#FF5A2C"
              strokeLinecap="round"
              strokeOpacity={0.5}
              strokeWidth={2.5}
            />
            <path
              d="M-20 120 C 80 70, 180 170, 260 120 S 420 130, 480 110"
              fill="none"
              stroke="#FF5A2C"
              strokeLinecap="round"
              strokeOpacity={0.3}
              strokeWidth={2}
            />
            <path
              d="M-20 140 C 80 90, 180 190, 260 140 S 420 150, 480 130"
              fill="none"
              stroke="#FF5A2C"
              strokeLinecap="round"
              strokeOpacity={0.16}
              strokeWidth={1.5}
            />
          </svg>
        </PatternTile>
      </div>
    </Section>
  );
}

function PatternTile({
  label,
  dark,
  children,
}: {
  label: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-[172px] overflow-hidden rounded-[16px] border border-[#E7E1D5] dark:border-border">
      {children}
      <div
        className={`absolute bottom-2.5 left-3 z-10 rounded-md px-2 py-1 font-mono text-[10px] tracking-[0.04em] ${
          dark ? "bg-black/45 text-[#ffd9cc]" : "bg-white/80 text-[#DF440F]"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

/* ============================================================
   06 · Components
   ============================================================ */
function ComponentsSection() {
  const [view, setView] = useState<"week" | "month" | "qtr">("month");
  return (
    <Section
      num="06"
      subtitle="Selected primitives from the production system. The complete library — every variant and state — lives in the component library reference."
      title="Components"
    >
      <SubLabel>Buttons & status</SubLabel>
      <div className="rounded-[22px] border border-[#E7E1D5] bg-[#FFFDF9] p-7 shadow-[var(--shadow-card)] dark:border-border dark:bg-card">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary action</Button>
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
      </div>

      <div className="mt-8">
        <SubLabel>Metric language</SubLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
      </div>

      <div className="mt-8">
        <SubLabel>Banners</SubLabel>
        <div className="grid gap-3">
          <Banner
            description="Compression is forming over OCT 18-22. Lift ADR ~$18 to capture the surge."
            icon={<Sparkles />}
            title="Ember signal · revenue opportunity"
            variant="ember"
          />
        </div>
      </div>
    </Section>
  );
}

/* ============================================================
   07 · System in action
   ============================================================ */
function SystemInActionSection() {
  return (
    <Section
      num="07"
      subtitle="A built section that shows the language in service of the product: warm canvas, single ember accent on the live metric, mono numerals throughout, the chart earning its one expressive beat on reveal."
      title="System in action"
    >
      <div className="overflow-hidden rounded-[22px] border border-[#E7E1D5] bg-[#F4F2EC] shadow-[var(--shadow-card)] dark:border-border dark:bg-background">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3 border-[#E7E1D5] border-b bg-[#FFFDF9] px-5 py-3 dark:border-border dark:bg-card">
          <div className="flex items-center gap-2">
            <Mark color="currentColor" size={22} />
            <span className="font-display font-semibold text-[15px] tracking-tight">
              RevPAR<span className="font-normal text-primary">MAX</span>
            </span>
          </div>
          <div className="ml-2 inline-flex items-center gap-2 rounded-md border border-input bg-[#FBF8F1] px-3 py-1.5 text-[13px] dark:bg-surface-2">
            <span className="font-mono text-[9px] text-low uppercase tracking-[0.12em]">
              Portfolio
            </span>
            <span>Skyline Collection</span>
            <ChevronDown className="size-3.5 text-mid" />
          </div>
          <div className="ml-2 inline-flex max-w-[300px] flex-1 items-center gap-2 rounded-md border border-input bg-[#FBF8F1] px-3 py-1.5 text-[13.5px] text-low dark:bg-surface-2">
            <Search className="size-3.5" />
            <span className="text-mid">Jump to property or report</span>
            <span className="ml-auto rounded border border-input px-1.5 py-px font-mono text-[10px]">
              ⌘K
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge dot variant="live">
              Live
            </Badge>
            <button
              aria-label="Notifications"
              className="relative inline-flex size-9 items-center justify-center rounded-md border border-input bg-transparent text-mid hover:bg-accent hover:text-acc-deep"
              type="button"
            >
              <Bell className="size-4" />
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
              />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          <div>
            <div className="font-mono text-[11px] text-mid uppercase tracking-[0.16em]">
              Portfolio · Q4 view
            </div>
            <h3 className="mt-1 font-display font-semibold text-2xl tracking-tight">
              Revenue command — quarter to date
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          <ForecastChart
            data={FORECAST}
            nowIndex={7}
            projectedDelta="+12% vs LY"
            projectedLabel="Projected · Dec"
            projectedValue={671_000}
          />
        </div>
      </div>
    </Section>
  );
}

/* ============================================================
   Footer
   ============================================================ */
function PageFooter() {
  return (
    <footer className="mt-24 flex flex-wrap justify-between gap-4 border-[#D8D5CD] border-t pt-7 font-mono text-[#6F6D66] text-[11px] uppercase tracking-[0.1em] dark:border-border dark:text-mid">
      <span>RevPARMAX · Brand Kit · 2026</span>
      <span>
        <a className="hover:text-primary" href="/design">
          /design
        </a>{" "}
        ·{" "}
        <a className="hover:text-primary" href="/design.md">
          /design.md
        </a>{" "}
        ·{" "}
        <a
          className="hover:text-primary"
          href="/component-library/index.html"
          rel="noopener"
          target="_blank"
        >
          /component-library
        </a>
      </span>
    </footer>
  );
}
