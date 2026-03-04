# 8b. Forecast Algorithm Specification

> **Previously absent — added in v1.1 to address adversarial finding #6.**

## Inputs

| Input | Source |
|---|---|
| Current OTB (rooms on books by date) | Latest `paceSnapshots` where `snapshotDate = today` |
| LY pace curve (rooms on books by advance window, LY) | `paceSnapshots` where `snapshotDate` = same calendar date, prior year |
| Budget occupancy + ADR | `budgets` table for current property/year/month |
| Property total rooms | `properties.totalRooms` |

## Algorithm — Demand-Weighted Revenue Projection (P1.18)

For each remaining date `d` in the current month:

**Step 1 — LY equivalent date**
```
d_ly = same calendar date, prior year
     // Leap year guard: if d_ly = Feb 29 and current year is not leap → use Feb 28 (ADR-004)
```

**Step 2 — LY remaining pickup at equivalent advance**
```
advance_days = d - today   // days until stay date
ly_otb_at_same_advance = paceSnapshot where forecastDate=d_ly AND snapshotDate=(d_ly - advance_days)
ly_otb_at_stay = auditRecord(d_ly).roomStatistics.roomsOccupied   // IN-014: use verified actuals
              ?? lastPaceSnapshot(d_ly).roomsOnBooks               // fallback if auditRecord absent

// IN-007: if ly_otb_at_same_advance is missing, skip pickup calc for this date;
//         use flat OTB × budget_adr as revenue fallback for that date only
if (!ly_otb_at_same_advance) → skip to Step 5 with projected_rooms[d] = current_otb[d]

ly_remaining_pickup = ly_otb_at_stay - ly_otb_at_same_advance
```

**Step 3 — TY pickup velocity ratio**
```
ty_pickup_trailing_7d = current_otb[d] - otb_7_days_ago[d]   // from paceSnapshot 7 days prior

// IN-008: if paceSnapshot from 7 days ago is missing, search ±3 days;
//         if none found, set velocity_ratio = 1.0 and label date as "sparse data"
ly_pickup_trailing_7d = ly_pace_curve[advance_days] - ly_pace_curve[advance_days + 7]

if (ly_pickup_trailing_7d === 0):
    velocity_ratio = 1.0   // flat assumption; display warning label per P1.18
else:
    velocity_ratio = ty_pickup_trailing_7d / ly_pickup_trailing_7d
    velocity_ratio = clamp(velocity_ratio, 0, 3.0)   // cap at 3× to prevent outlier explosion
```

**Step 4 — Projected rooms**
```
projected_rooms[d] = current_otb[d] + (ly_remaining_pickup × velocity_ratio)
projected_rooms[d] = clamp(projected_rooms[d], current_otb[d], property.totalRooms)
```

**Step 5 — Projected revenue per date**
```
rate = budgetAdr ?? current_otb_adr[d] ?? lyAdr[d]   // fallback chain

// IN-009: if rate is null after full fallback exhaustion:
//         set projected_revenue[d] = null; mark date as "rate unavailable" in chart
//         DO NOT multiply — projected_rooms × null = NaN which breaks chart render
if (!rate) → projected_revenue[d] = null; mark "rate unavailable"
else projected_revenue[d] = projected_rooms[d] × rate
```

**Step 6 — Month-end projection total (P1.18 display)**
```
// IN-023: filter actuals to status === 'verified' only
forecast_total = sum(actuals[d].roomRevenue for d in past_dates where auditRecord.status === 'verified')
              + sum(projected_revenue[d] for d in remaining_dates where projected_revenue[d] !== null)
```

## Fallback: No LY Data Available

When `ly_pace_curve` is absent (new property, or property opened < 1 year ago):
- Projection = `current_otb[d] × budget_adr` (flat, no pickup adjustment)
- Display label: *"Forecast based on current bookings only — no prior year data available"*
- This matches PRD P1.18 acceptance criteria

## Pickup Velocity Alert Threshold (P1.22)

```
alert_condition = (ty_pickup_trailing_7d / ly_pickup_trailing_7d) < property.pickupVelocityThresholdPct / 100
                  AND ly_pickup_trailing_7d > 0   // ECH: skip if LY rate = 0
```

Alert resolves when `velocity_ratio >= threshold` for 2 consecutive evaluation days (ADR-007).

## LY vs TY Pace Overlay Color Logic (P1.21)

```
pace_gap_pct = (current_otb[d] - ly_otb_at_same_advance) / ly_otb_at_same_advance × 100

if pace_gap_pct >= 0:              color = GREEN
if pace_gap_pct >= -paceYellowThresholdPct AND < 0:  color = YELLOW
if pace_gap_pct < -paceRedThresholdPct:              color = RED
if ly_otb_at_same_advance is null: display = "—" (no color)
```

Thresholds sourced from `property.paceYellowThresholdPct` and `property.paceRedThresholdPct` (defaults: 10% each, configurable per ADR per PRD P1.21).

---
