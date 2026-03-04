---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'RevParMax — modernizing a hotel multi-property revenue management SaaS'
session_goals: 'Feature parity (old app + market), solve PDF data ingestion, UX improvements, produce feature list for PRD'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'Cross-Pollination', 'SCAMPER Method']
ideas_generated: [82]
session_active: false
workflow_completed: true
---

# Brainstorming Session Results

**Facilitator:** boss
**Date:** 2026-03-03

---

## Session Overview

**Topic:** RevParMax — modernizing a hotel multi-property revenue management SaaS
**Goals:** Feature parity with old app + market, solve PDF/unstructured data ingestion, improve UX, produce a comprehensive feature list for the PRD

**Key Constraints Identified:**
- Ownership groups (2–10 properties, mid-sized) are the primary user — not revenue managers
- Night auditor is the data provider — must minimize their burden
- Manual data import is the #1 operational bottleneck
- No multi-currency requirement
- Minimize the number of file format importers — one universal ingestion pipeline
- Self-serve onboarding is non-negotiable — no more manual client setup

**Techniques Used:** Question Storming → Cross-Pollination → SCAMPER Method

---

## Existing App Feature Inventory (Parity Requirements)

### Dashboard / Overview
- Top-line KPI bar: Revenue, Occupancy, ADR, RevPAR (current month)
- LY vs TY performance bar chart, toggleable by Revenue / RevPAR / ADR / Occupancy
- Revenue Targets table: category breakdown (Rooms, Restaurant, M&B, Guest Services, Concessionaires, Telecom) vs budget with progress bars and % completion
- Multi-property / multi-company selector with date navigation (year / month / day)

### History > Rooms
- YoY % change summary bar
- Rooms Statistics: Out of Order Rooms, No Shows, Same Day Cancellations, Comp Rooms — columns: TODAY / MTD / LYMTD / YTD / LYYTD
- Rooms Balances: Revenue, RevPAR, Occupancy, ADR, Rooms — same column structure

### History > Non-Rooms
- YoY growth summary (MTD and YTD)
- Donut charts: Today / MTD / YTD breakdown by non-room revenue category
- Non-Rooms Revenue Balances table: CATEGORY / TODAY / MTD / BUDGET / LYMTD / YTD / LYYTD

### History > Competition
- YoY occupancy and ADR change summary
- Line chart: your property vs named competitors, toggleable Occupancy / ADR / RevPAR
- Competition table: HOTEL NAME / RATE / TOTAL ROOMS / AVAIL ROOMS / DAILY OCC / MTD AVAIL / MTD OCCUPANCY

### History > Payments
- YoY growth summary (MTD and YTD)
- Donut charts: Today / MTD / YTD by payment type
- Payments table: PAYMENT TYPE / TODAY / MTD / YTD
- Payment types: AMEX, Cash, Interac, Mastercard, VISA, Check, Direct Bill, Discover

### Attachments
- Date-contextual file list
- Multi-format support (PDF, Excel, CSV)
- Download capability

### Forecast
- 4-line chart: Last Year / Forecast / Current / Budget — toggleable RevPAR / Rooms / ADR / Occupancy
- Interactive Budget Occupancy and Budget ADR controls (recalculates forecast revenue in real time)
- ADR on Booked Rooms vs ADR Target on Forecasted Rooms display
- Day-by-day forecast table: DATE / PACE (TY, LY, NET) / ROOMS (Current, Forecast, Budget) / RATE (Current, Budget) / NOTIFICATION

### Daily Data Entry (Night Auditor Interface)
- Pace tab: 365-day forward snapshot per audit date — Date / Rooms on Books / ADR
- Room Statistics tab: Rooms Occupied, ADR, Same Day Cancellations (Room Revenue = ADR × Rooms Occupied derived automatically)
- Non-Rooms tab: Parent Category / Category Name / Amount (two-level revenue category hierarchy, custom per property)
- Competition tab: manual competitor data entry
- Payments tab: payment type / amount entry
- Files tab: file upload and attachment management

### Monthly Budget Entry
- Per property, per month, per revenue category
- Annual budget broken into monthly targets
- Feeds budget column in forecast and progress bars on overview

### Settings / Codes / Reporting
- Property and account settings
- Revenue code and category management
- Report generation and export

---

## Technique Execution Results

### Technique 1: Question Storming
**Key Questions That Shaped the Session:**
- What does the owner need to see in 5 seconds to know if today is good or bad?
- What makes an owner pick up the phone and call their revenue manager — and how do we make that call unnecessary?
- What decisions is the owner making where they're flying blind today?
- If data just appeared in the system every morning without anyone doing anything — what would it look like and where would it come from?
- When the booking pace this year differs from last year, does the system know?

**Key Insights:**
- Primary user is ownership, not revenue managers — fundamentally different product than enterprise hotel software
- The night auditor is a data provider, not a user — their friction is our friction
- The 365-day pace snapshot stored daily is the core data asset the entire forecasting system is built on
- Room Revenue = ADR × Rooms Occupied is derived, not entered — built-in validation opportunity

### Technique 2: Cross-Pollination
**Domains Mined:** Airlines (yield management), Personal Finance (Mint/YNAB), Project Management (Procore), Waze (crowdsourced intelligence), Weather Forecasting (probabilistic prediction), Healthcare (bed management), Sports Analytics (Moneyball), Real Estate (portfolio yield)

**Key Breakthroughs:**
- Booking curve benchmarking using the property's own stored daily snapshots — no external data needed
- Probabilistic forecasting (confidence intervals + Bear/Base/Bull scenarios) — honest forecasting vs false precision
- Market Pulse network intelligence — anonymized aggregate pace across all clients in a market
- Payment mix as guest segment proxy — intelligence without a CRM
- RevPAR yield vs asset value — connects ops data to investment thesis

### Technique 3: SCAMPER
**Key Eliminations:** Manual competition entry, format-specific importers, monthly budget grid, manual property onboarding, UUID attachment names
**Key Combinations:** Upload + data entry → verify-only workflow; Forecast chart + rate calendar; Push alert + narrative + recommended action
**Key Reversals:** Data flow (pull instead of push); Dashboard direction (system asks owner questions); Budget direction (start from desired outcome, work backward); Reporting (exceptions-only default)

---

## Idea Organization and Prioritization

### Theme 1: Data Ingestion & Pipeline

| Feature | Priority |
|---|---|
| Universal AI Drop Zone — one endpoint, any format (PDF/Excel/CSV) | P1 |
| AI Verify Flow — split-screen original doc + extracted data, confirm or correct yellow fields | P1 |
| Confidence Scoring — green = auto-approved, yellow = needs review | P1 |
| Revenue Category Auto-Mapper — learns property vocabulary after first upload | P1 |
| Email-In Ingestion — night auditor forwards PMS report to RevParMax address | P1 |
| Bulk Historical Backfill — new property uploads folder of old exports, AI reconstructs history | P1 |
| Auto-Named Attachments — AI names files from content, not UUIDs | P1 |
| Opera OHIP Connector — direct API pull for Opera Cloud properties | P2 |
| Browser Extension OTA Harvester — captures OTA data from authenticated partner portals | P2 |
| PMS Pull Mode — RevParMax pulls data nightly for connected properties | P2 |
| AI Training Loop — every verified upload improves extraction accuracy | P2 |

### Theme 2: Forecasting & Pace

| Feature | Priority |
|---|---|
| Future Rooms Sold — Living Snapshot (365-day forward, stored as daily snapshots) | P1 |
| LY vs TY Pace Overlay — color-coded gap (green = ahead, red = behind) | P1 |
| Demand-Weighted Revenue Projection — OTB + LY pickup pace → projected month-end total | P1 |
| Pickup Velocity Alert — flags dates booking slower than LY pace at same point | P1 |
| Smart LY — flags anomaly years, offers normalized LY curve alongside raw LY | P2 |
| Weighted Pace Blending — blend 1-year / 2-year / AI-selected pace | P2 |
| Booking Curve Benchmarking — property's own historical pace as benchmark | P2 |
| Demand Heatmap Calendar — 12-month calendar view, colored by occupancy intensity | P2 |
| Forecast Confidence Intervals — range: "$385K–$438K (80% confidence)" | P2 |
| Bear/Base/Bull Scenario Band — three scenarios as a band on forecast chart | P3 |
| Rate Calendar — interactive day-by-day rate planning within forecast view | P2 |

### Theme 3: Budget & Financial Planning

| Feature | Priority |
|---|---|
| Conversational Budget Setting — "I want $4M this year, heavier in Q3" → AI proposes monthly distribution | P1 |
| Rolling Re-Forecast — three lines: Original Budget / Rolling Forecast / Actuals | P1 |
| Variance Alert Engine — push when RevPAR drops X% below budget for N consecutive days | P1 |
| Budget vs Rolling Forecast Split — Monthly view shows all three columns | P1 |
| Smart Budget Proposal — AI analyzes 3 years of history, proposes realistic budget with reasoning | P2 |
| Outcome-First Budget — enter desired revenue outcome, system works backward to required pace | P2 |
| Capacity-Adjusted Budget — OOO rooms automatically recalculate budget targets | P2 |

### Theme 4: AI & Natural Language Interface

| Feature | Priority |
|---|---|
| Natural Language Query — "How did March track vs last year?" answered instantly | P2 |
| Forecast Explainer — "Why is your March forecast lower than budget?" with specific numbers | P2 |
| Scenario Conversation — "What if ADR drops $15 this weekend?" with real-time math | P2 |
| NL Alert Builder — describe alert in plain English, system creates the rule | P2 |
| Alert with Explanation + Action — signal + context + suggested action in one notification | P1 |
| Proactive System — system initiates: "Good morning. Riverport had its weakest pickup week in 3 months" | P3 |
| Exceptions-Only Default — dashboard shows only what needs attention; full data one click away | P2 |

### Theme 5: Ownership Dashboard & UX

| Feature | Priority |
|---|---|
| Portfolio Sidebar — all properties as persistent left sidebar with live status | P1 |
| One-Screen Owner Dashboard — property rows with OCC bar, RevPAR vs budget gauge, trend arrow | P1 |
| Configurable KPI Tiles — drag-and-drop metric selection per ownership group | P2 |
| Portfolio Heat Map — properties × months grid, colored by performance vs budget | P2 |
| Financial Health Score — single 0–100 score per property, updated daily | P2 |
| Timeline Scrubber — drag across horizontal timeline instead of dropdown date pickers | P2 |
| Property-to-Property Benchmarking — internal comparison within ownership portfolio | P2 |
| Weekly Digest Email — Monday plain-English summary, no login required | P2 |
| Mobile Portfolio Pulse — property cards, push alerts, one-tap drill-down | P3 |

### Theme 6: Competitive Intelligence

| Feature | Priority |
|---|---|
| OTA Rate Scraper — nightly pull of competitor rates from public OTA pages | P2 |
| Demand Signal Calendar — local events overlaid on pace calendar from public APIs | P2 |
| Flash Opportunity Alert — competitor raises rates → immediate push notification | P2 |
| Price Elasticity Memory — learns property's demand curve from historical rate/pickup data | P3 |

### Theme 7: Intelligence & Decision Support

| Feature | Priority |
|---|---|
| Rate Recommendation Engine — flags weak dates with specific rate suggestions and math | P2 |
| Recommended Actions — 2-3 weekly suggestions surfaced automatically | P2 |
| Day-of-Week Performance Fingerprint — radar chart of Mon–Sun OCC and ADR patterns | P2 |
| Revenue Mix Optimizer — flags underperforming non-room revenue vs benchmarks | P3 |
| Length of Stay Intelligence — arrival day revenue value analysis | P3 |
| Payment Mix → Guest Segment Proxy — AMEX = premium leisure, Direct Bill = corporate | P3 |
| No-Show → Overbooking Confidence Score — safe overbooking suggestion from history | P3 |

### Theme 8: Reporting & Exports

| Feature | Priority |
|---|---|
| One-Click Board Report — polished PDF: portfolio summary, property breakdown, narrative | P1 |
| Saved Views — named report configurations (Board Meeting View, Weekly Ops View) | P2 |
| Performance Narrative Generator — any view → plain-English paragraph in one click | P2 |
| Annual Property Wrapped — year-end visual story, shareable, presentation-ready | P3 |
| Raw Data API — read-only API for accountants and asset managers | P3 |

### Theme 9: Network & Market Intelligence

| Feature | Priority |
|---|---|
| Historical Data Moat — stored daily snapshots build property-specific demand model over time | P1 (by design) |
| Market Pulse — anonymized aggregate pace across all RevParMax clients in a market | P3 |
| Shared Event Intelligence — one client's event annotation informs all clients in that market | P3 |
| RevPAR Yield vs Asset Value — connects ops data to investment performance | P3 |

### Theme 10: Onboarding & Platform

| Feature | Priority |
|---|---|
| Self-Serve Setup Wizard — 5 steps, 20 minutes, zero manual involvement | P1 |
| Guided AI Onboarding — first upload trains extractor, category verification, done | P1 |
| Demo Mode — realistic synthetic data lets prospects try before signing up | P2 |
| Night Auditor as Passive Pipeline — email forward or file drop, no training required | P1 |

---

## Session Summary

### Total Ideas Generated: 82

### Breakthrough Concepts

1. **The Verify-Only Workflow** — Inverting the night audit from data entry to data confirmation. AI does the work, auditor confirms exceptions. 45 minutes → 3 minutes.

2. **Conversational Everything** — Budget setting, alert creation, scenario modeling, historical queries — all via natural language. No forms, no grids, no configuration panels.

3. **The Living Snapshot Model** — Storing every daily pace snapshot creates a historical booking curve database that powers forecasting, benchmarking, and anomaly detection — all from data already being collected.

4. **Exceptions-Only Default** — The dashboard shows only what needs attention. Full data is available but not forced. Designed for the 60-second morning check, not the 2-hour analysis session.

5. **Market Pulse Network** — Anonymized aggregate data from all clients in a market creates a real-time competitive benchmark that improves with every new client. Network effect as competitive moat.

### Action Planning

**This Week:**
1. Document parity feature list as formal PRD requirements (use this session output as source)
2. Spike the AI ingestion pipeline — test PDF extraction accuracy on actual Opera PMS reports from the backup folder
3. Design the verify flow UX — this is the core night auditor experience

**Phase 1 Build Sequence:**
1. Self-serve onboarding + property setup
2. Universal AI ingestion + verify flow
3. Core parity features (all 17 from existing app)
4. Portfolio sidebar + one-screen owner dashboard
5. Conversational budget setting
6. Rolling re-forecast
7. Push notifications with context

**Phase 2 Build Sequence:**
1. Demand heatmap calendar
2. NL query interface
3. Competitive rate scraper
4. Financial health score + weekly digest
5. Rate recommendation engine
6. Board report export
7. Forecast confidence intervals

**Phase 3 (Future):**
Mobile app · Market Pulse network · Price elasticity memory · Investment yield metrics · Annual Property Wrapped · Raw data API

---

*Session facilitated using BMAD Brainstorming Workflow — AI-Recommended Technique sequence*
*Techniques: Question Storming → Cross-Pollination → SCAMPER*
