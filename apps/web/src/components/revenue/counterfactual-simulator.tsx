import { useMemo, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const BASE_ADR = 249;
const BASE_OCC = 0.91;
const ROOMS = 100;
const BASE_REV = Math.round(BASE_ADR * BASE_OCC * ROOMS);

function model(pct: number) {
  const adr = Math.round(BASE_ADR * (1 + pct / 100));
  const occ = Math.max(0.5, Math.min(0.99, BASE_OCC - 0.001_67 * pct));
  const rev = Math.round(adr * occ * ROOMS);
  const impact = rev - BASE_REV;
  const impactPct = (impact / BASE_REV) * 100;
  const conf = Math.max(
    58,
    Math.min(97, Math.round(92 - Math.abs(pct - 12) * 0.6))
  );
  return { adr, occ, rev, impact, impactPct, conf };
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="font-mono text-[9.5px] text-low uppercase tracking-wide">
        {label}
      </div>
      <div className="tnum mt-0.5 font-display font-medium text-2xl text-foreground tracking-tight">
        {value}
      </div>
    </div>
  );
}

/** "What if we'd priced differently?" — drag ADR; everything recomputes live. */
export function CounterfactualSimulator({ className }: { className?: string }) {
  const [pct, setPct] = useState(12);
  const alt = useMemo(() => model(pct), [pct]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-slot="counterfactual-simulator"
    >
      <div className="mb-4">
        <div className="font-display font-semibold text-lg tracking-tight">
          Counterfactual · Jun 4–8
        </div>
        <div className="mt-1 font-mono text-[10.5px] text-mid uppercase tracking-wide">
          Actual decision vs alternative scenario
        </div>
      </div>

      <div className="grid items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr_auto]">
        <div className="rounded-lg border border-border bg-secondary p-[18px]">
          <div className="mb-3.5 font-mono text-[10px] text-mid uppercase tracking-wide">
            Actual decision
          </div>
          <Cell label="ADR (avg)" value={formatCurrency(BASE_ADR)} />
          <Cell label="Occupancy" value="91%" />
          <Cell label="Revenue" value={formatCurrency(BASE_REV)} />
        </div>

        <div className="flex items-center justify-center font-mono font-semibold text-low text-xs">
          vs
        </div>

        <div className="rounded-lg border border-pos/34 bg-pos/7 p-[18px]">
          <div className="mb-3.5 font-mono text-[10px] text-pos uppercase tracking-wide">
            Alternative
          </div>
          <Cell label="ADR (avg)" value={formatCurrency(alt.adr)} />
          <Cell
            label="Occupancy (est.)"
            value={`${Math.round(alt.occ * 100)}%`}
          />
          <Cell label="Revenue (est.)" value={formatCurrency(alt.rev)} />
        </div>

        <div className="flex min-w-[150px] flex-col justify-center rounded-lg border border-primary/30 bg-accent p-[18px]">
          <div className="font-mono text-[9.5px] text-acc-deep uppercase tracking-wide">
            Impact
          </div>
          <div className="tnum mt-1.5 font-display font-semibold text-3xl text-acc-deep tracking-tight">
            {alt.impact >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(alt.impact))}
          </div>
          <div className="mt-0.5 font-bold text-[12px] text-acc-deep">
            {alt.impactPct >= 0 ? "+" : "−"}
            {Math.abs(alt.impactPct).toFixed(1)}%
          </div>
          <div className="mt-2.5 font-mono text-[10.5px] text-mid">
            Confidence <b className="text-foreground">{alt.conf}%</b>
          </div>
        </div>
      </div>

      <div className="mt-5 border-border border-t pt-[18px]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[11px] text-mid uppercase tracking-wide">
            Change ADR
          </span>
          <span className="font-mono font-semibold text-acc-deep text-sm">
            {pct > 0 ? "+" : ""}
            {pct}%
          </span>
        </div>
        <Slider
          max={20}
          min={-20}
          onValueChange={(v) => setPct(Array.isArray(v) ? v[0] : v)}
          value={[pct]}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-low">
          <span>−20%</span>
          <span>0%</span>
          <span>+20%</span>
        </div>
      </div>
    </div>
  );
}
