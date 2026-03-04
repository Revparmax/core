# Product Requirements Document — RevParMax

**Version:** 1.1
**Date:** 2026-03-03
**Source:** Brainstorming Session `_bmad-output/brainstorming/brainstorming-session-2026-03-03-2014.md`
**Status:** Draft

---

## 1. Product Vision

RevParMax is a multi-property hotel revenue management SaaS designed for **ownership groups** — not enterprise revenue managers. It delivers daily operational intelligence and forecasting to hotel owners with 2–10 properties, replacing manual spreadsheets and fragmented reporting with a single, self-serve platform that requires no internal revenue management expertise to operate.

The core promise: **an owner should know in 60 seconds whether today is good or bad, for every property they own.**

---

## 2. Problem Statement

### For Ownership Groups
Hotel ownership groups with small-to-mid-size portfolios have no good tools. Enterprise solutions (IDeaS, Duetto) are priced and built for large chains with dedicated revenue management staff. Spreadsheets break. Manual reporting from night auditors takes 30–45 minutes per property per night and produces data nobody analyzes.

Key problems:
- **No consolidated view** across properties — owners toggle between systems or receive emailed PDFs
- **Forecasting is manual and wrong** — gut-feel budgets, no booking curve analysis, no pace tracking
- **Data ingestion is the bottleneck** — night auditor burden is high, data arrives late, errors are common
- **Budget is a spreadsheet** — no connection between budget, forecast, and actuals
- **Competitive intelligence is absent** — owner doesn't know if their ADR is positioned correctly

### For Night Auditors
Night auditors run the nightly close on their PMS and produce a daily report as a byproduct. Their interaction with RevParMax must be minimal: log in, upload tonight's report, confirm the AI read it correctly. That's it. Any solution that requires training, form-filling, or manual data transcription from night auditors will fail in practice.

### For the Business (RevParMax)
Manual client onboarding is not scalable. Every new property requires a setup call, custom configuration, and handholding. Self-serve is the only path to growth.

---

## 3. Goals & Success Metrics

### Product Goals
1. Replace manual nightly data entry with an AI-verified ingestion pipeline
2. Deliver accurate 30/60/90-day revenue forecasts automatically
3. Give ownership groups a single dashboard across all properties
4. Enable self-serve onboarding in under 20 minutes with zero manual involvement

### Success Metrics (Phase 1)

| Metric | Target | Notes |
|--------|--------|-------|
| Onboarding time (new property, no PMS integration) | < 30 minutes | Excludes budget entry, which is optional at onboarding |
| Night auditor nightly submission time | < 5 minutes per property | Upload + verify flow only |
| AI extraction accuracy (auto-approved without correction) | > 90% of fields | A "field" is a named data point (e.g., Rooms Occupied, VISA total). Rounding differences ≤ $1 do not count as failures. |
| Owner dashboard load-to-insight time | < 60 seconds | Time from login to reading today's KPI bar |
| Month-end forecast accuracy vs actuals | ± 8% | Applies only to properties with ≥ 12 months of history |

---

## 4. Users & Personas

### Primary: Hotel Owner / Ownership Group
- Owns 2–10 properties, typically limited-service or select-service segment
- Checks portfolio performance in the morning, often on mobile
- Does not want to learn software — wants answers, not data
- Key question: *"Is each property on track this month?"*
- Key decisions: Rate adjustments, capital allocation, GM accountability
- **Product surface:** Owner dashboard, portfolio sidebar, forecast, budget, alerts

### Secondary: Night Auditor (Report Uploader + Verifier)
- Runs the nightly close on the PMS (Opera, Cloudbeds, etc.)
- Produces a daily report (PDF or export) as a normal part of their job
- Has a RevParMax account for their property — logs in, uploads tonight's report, confirms the AI extraction is correct
- Does **not** do data entry. Does **not** configure the system. Does **not** manage categories or budgets.
- Interaction is: **upload → verify → done**
- **Product surface:** Report upload screen, AI verify flow only

### Tertiary: General Manager / Property Manager
- Monitors property performance on behalf of ownership
- Manages revenue categories, configures competitor list, enters or reviews budget
- Covers night auditor role at smaller properties
- May complete property setup during onboarding
- **Product surface:** Full property view, settings, budget, onboarding wizard

---

## 5. Core Data Model & Architecture Concepts

### The Living Snapshot Model (foundational)
Every day, a 365-day forward pace snapshot is stored for each property:
- `date` → `rooms_on_books` + `adr`

This daily archive is the foundation for:
- Booking curve construction (how far in advance does this property fill?)
- Pace comparison (TY vs LY at the same point in advance)
- Pickup velocity tracking (is booking slowing down?)
- Anomaly detection (is this week unusual?)

This data is captured as a byproduct of the nightly report submission — no extra effort.

### Data Ingestion Model (current + future multi-source)
**Current structure (existing data model):**
- One audit per property per date (unique by `company_id + date`)
- Stats keyed by `audit_id + category/type` (rooms, revenue, payments, competition)
- Room categories and payment types are global (shared across properties)

**Future requirement (multi-source intraday data):**
Adopt **Option A**: keep one canonical daily audit record and allow multiple source inputs per day.
- Add both `source` (human-readable) and `data_import_id` (FK lineage) to stats/pace tables to track multiple inputs per day
- Update unique constraints to include source (e.g., `audit_id + category_id + source`)
- Define a roll-up rule for the “official” daily snapshot (materialized or computed)
**Note:** Phase 1 runs with a single source (nightly audit). Multi-source support is a future extension using the fields above.

### Derived Metrics (never entered manually)
- `room_revenue = adr × rooms_occupied` (derived, used for validation)
- `revpar = room_revenue / total_rooms` (derived)
- `occupancy = rooms_occupied / available_rooms` (derived)

### Revenue Category Hierarchy
Two-level hierarchy, custom per property:
- Parent Category (e.g., Food & Beverage)
  - Category (e.g., Restaurant, Room Service, Bar)

Categories are configured during onboarding and learned by the AI extractor after first upload.

### Data Retention
- Living Snapshot rows: retained indefinitely per property (core product asset)
- Nightly report files: retained for 7 years (audit compliance)
- Properties that churn: data retained for 90 days post-cancellation, then deleted on request or automatically
- Storage estimate: ~1,825 snapshot rows/property/year × ~500 properties = ~900K rows/year; manageable at this scale without archival strategy in Phase 1

---

## 6. Feature Requirements

### Phase 1 — Core Platform (MVP)

---

#### 6.1 Onboarding & Property Setup

---

**P1.1 — Self-Serve Setup Wizard**

5-step wizard: Account → Property Details → Room Count & Categories → Competitor Setup → First Upload. Budget entry is optional and can be completed after onboarding.

**Acceptance Criteria:**
- A new user can complete property setup from account creation to first data submission without contacting RevParMax support
- Steps 1–4 complete in under 15 minutes for a prepared user (property details and category list available)
- Step 5 (First Upload) can be skipped and completed later without blocking access to the app
- The wizard is blocked from advancing past Step 3 if required fields (property name, room count, at least one revenue category) are missing
- A partially completed wizard can be resumed from the last completed step

---

**P1.2 — Guided AI Onboarding**

First file upload trains the AI extractor for the property. System presents extracted categories side-by-side with the source document for owner/GM confirmation. Confirmed mappings persist permanently.

**Acceptance Criteria:**
- First file upload triggers AI extraction and redirects to a category mapping review screen
- Mapping screen shows: extracted label (left) → proposed RevParMax category (right), with confidence indicator
- User can accept all, accept individual, or remap any category to an existing or new category
- On confirmation, all mappings are saved to the property's extractor profile
- Category mappings are viewable and editable in Property Settings after onboarding
- On all subsequent uploads, previously mapped categories are auto-confirmed (no re-review required)

---

**P1.3 — Nightly Report Submission (Logged-In Upload)**

Night auditors submit nightly reports by logging into RevParMax and uploading the PMS export. No email forwarding. No anonymous access. The auditor has a property-scoped account.

**Acceptance Criteria:**
- Night auditor can log in and reach the report submission screen in under 60 seconds
- Upload accepts: PDF, XLSX, XLS, CSV
- Unsupported file types display a clear error listing accepted formats
- Files over 50 MB are rejected with an explicit size limit error
- Successful upload triggers AI extraction and redirects to the Verify Flow (P1.5) automatically
- The submission screen shows the last submission date and status so the auditor can confirm they're not duplicating

---

#### 6.2 Universal AI Ingestion Pipeline

---

**P1.4 — Universal AI Extraction Engine**

Single ingestion pipeline handles all accepted file formats. AI parses structure and extracts: audit date, rooms on books (365-day pace), rooms occupied, ADR, revenue by category, payment type totals, and competition data.

**Acceptance Criteria:**
- PDF, XLSX, XLS, and CSV files all reach the extraction pipeline without format-specific routing
- AI identifies the audit date from file content; if no date is found, the user is prompted to confirm the date before extraction proceeds
- Extracted data maps to the property's defined revenue categories using the learned category mapper (P1.6)
- Extraction completes within 30 seconds for a standard PMS report ≤ 10 pages / ≤ 5 MB

---

**P1.5 — AI Verify Flow**

The primary night auditor interaction. Split-screen: original document (left) + extracted data (right). Auditor reviews and confirms. Designed to take 2–3 minutes.

Confidence scoring:
- 🟢 **Green** — high confidence, auto-approved, no action required
- 🟡 **Yellow** — low confidence or first time seen, requires confirmation
- 🔴 **Red** — field not found or extraction failed, requires manual entry

**Failure modes handled:**

| Scenario | Behavior |
|----------|----------|
| Full extraction failure (unreadable file, scanned image, wrong document) | Error screen with: original file preview, failure reason, option to retry with a different file, or proceed to manual entry with all fields blank |
| Partial extraction (< 50% of expected fields found) | Yellow/red for all missing fields; user prompted to review and fill before submitting |
| Unsupported document structure (e.g., wrong PMS format) | Flagged as unrecognized format; system asks user to confirm category mappings before accepting |
| Duplicate submission (same audit date already has a confirmed record) | Warning displayed with prior submission date and submitter; user must explicitly confirm overwrite |

**Acceptance Criteria:**
- Every extracted field displays a confidence indicator (green / yellow / red)
- Green fields are pre-confirmed; user cannot un-confirm them individually (only reject entire submission)
- User cannot submit without confirming or filling all yellow and red fields
- Corrected fields are logged and fed back to the AI training loop
- Full extraction failure presents a clear error state with retry and manual entry options — never a blank screen or silent failure
- On successful submission, a confirmation screen shows: audit date, fields accepted, any corrections made

---

**P1.6 — Revenue Category Auto-Mapper**

Learns each property's PMS vocabulary after the first confirmed upload. Maps source labels to RevParMax category hierarchy automatically on all subsequent uploads.

**Acceptance Criteria:**
- After first upload confirmation, all accepted mappings are persisted in the property's extractor profile
- On second upload, previously mapped labels are auto-confirmed (green, no user action)
- New labels not seen before appear as yellow for confirmation
- Handles case-insensitive variations, common abbreviations, and minor typos (e.g., "F&B Rev", "F and B", "Food & Bev" all map to the same category)
- Category mapper is viewable and editable in Property Settings

---

**P1.7 — Auto-Named Attachments**

AI names stored files from content, not system-generated UUIDs.

Format: `[property-slug]-[report-type]-[YYYY-MM-DD].[ext]`
Example: `riverport-night-audit-2026-03-03.pdf`

**Acceptance Criteria:**
- All files stored in the system use the AI-generated naming format
- No UUID-only file names appear anywhere in the UI
- File names are displayed in full in the attachments list without truncation on desktop viewport
- If AI cannot determine report type from content, type defaults to `report`

---

**P1.8 — Bulk Historical Backfill**

New properties can upload historical exports during onboarding to establish LY baseline and booking curve data from day one.

**Acceptance Criteria:**
- User can upload multiple files (or a ZIP archive) in a single session during onboarding Step 5
- System processes each file independently and assigns it to a calendar date based on extracted audit date
- A backfill summary screen shows: files processed / dates mapped / dates with extraction failures
- Dates with failed extraction are listed for manual review before backfill is finalized
- After successful backfill, LY data is available in forecast and history views for all covered dates
- Backfill can be initiated post-onboarding from Property Settings

---

#### 6.3 Manual Entry (Fallback Only)

Manual entry is a fallback for two specific scenarios:
1. The property's PMS does not produce exportable reports
2. A file upload failed extraction entirely (P1.5 full failure flow)

It is not the primary data submission path and is not promoted to night auditors.

---

**P1.9 — Manual Data Entry Interface**

Tabs per audit date. Accessed from the property's date context.

| Tab | Fields |
|-----|--------|
| Pace | 365-day forward: Date / Rooms on Books / ADR |
| Room Statistics | Rooms Occupied, ADR, Same Day Cancellations, No Shows, Comp Rooms, OOO Rooms |
| Non-Rooms | Parent Category / Category / Amount |
| Competition | Competitor name / Rate / Available Rooms / Daily Occupancy |
| Payments | Payment type / Amount |
| Files | File upload and attachment management |

Room Revenue is derived automatically (ADR × Rooms Occupied) — never entered.

**Acceptance Criteria:**
- All six tabs are accessible when no verified file submission exists for the selected audit date
- Room Revenue field is read-only and displays calculated value in real time as ADR and Rooms Occupied are entered
- Submitting manual entry for a date that already has a confirmed file-based record requires an explicit overwrite confirmation
- Partially completed manual entry can be saved as a draft and completed later
- Manual entry records are visually distinguished from file-based records in the audit date history

---

#### 6.4 Dashboard & Navigation

---

**P1.10 — Portfolio Sidebar**

Persistent left sidebar listing all properties in the authenticated ownership group with live status.

**Acceptance Criteria:**
- Sidebar renders all properties accessible to the logged-in user, grouped by ownership entity if applicable
- Each property entry shows: property name, today's data status (✅ received / ⚠️ missing / 🔴 alert)
- Alert badge appears on any property with an active variance or pickup alert
- Clicking a property switches the main view context to that property within 1 second
- Sidebar is collapsible to maximize screen real estate on smaller viewports

---

**P1.11 — Multi-Property / Multi-Company Selector + Date Navigation**

**Acceptance Criteria:**
- Company dropdown lists all ownership entities the authenticated user has access to
- Property selector is filtered to the selected company
- Selecting a different company + property updates all views without a full page reload
- Date navigator supports: Year / Month / Day granularity with prev/next controls
- Current date is selected by default on first load

---

**P1.12 — Owner Overview Dashboard**

The primary owner surface. Answers "is today good or bad?" at a glance.

- Top-line KPI bar: Revenue, Occupancy, ADR, RevPAR (current month MTD)
- LY vs TY performance bar chart, toggleable: Revenue / RevPAR / ADR / Occupancy
- Revenue Targets table: Budget / Actual / % Complete / Progress Bar per category

**Acceptance Criteria:**
- KPI bar displays MTD values for the currently selected property and month
- LY vs TY chart renders for all properties with ≥ 1 prior year of data; properties without LY show MTD actuals only with a clear label
- Toggling between Revenue / RevPAR / ADR / Occupancy updates the chart without page reload within 500ms
- Revenue Targets table shows all configured revenue categories with budget, actual, and progress bar
- Categories with no budget set display actual only, with a "Set budget" prompt
- Dashboard loads to a readable state within 2 seconds on a standard connection

---

#### 6.5 Historical Reporting

---

**P1.13 — History > Rooms**

- YoY % change summary bar
- Rooms Statistics table — TODAY / MTD / LYMTD / YTD / LYYTD:
  - Out of Order Rooms, No Shows, Same Day Cancellations, Comp Rooms
- Rooms Balances table — same column structure:
  - Revenue, RevPAR, Occupancy, ADR, Rooms Sold

**Acceptance Criteria:**
- All five time columns render correctly for properties with ≥ 12 months of history
- Properties with < 12 months display "—" for LY columns with a tooltip explaining the gap
- YoY % change summary updates when the date context changes
- Negative YoY values are displayed in red; positive in green

---

**P1.14 — History > Non-Rooms**

- YoY growth summary (MTD and YTD)
- Donut charts: Today / MTD / YTD breakdown by non-room revenue category
- Non-Rooms Revenue Balances table: CATEGORY / TODAY / MTD / BUDGET / LYMTD / YTD / LYYTD

**Acceptance Criteria:**
- Donut charts render for all three periods; periods with $0 across all categories display an empty state, not a broken chart
- All configured non-room revenue categories appear in the table; zero-revenue categories show $0, not blank
- Budget column shows "—" for categories without a set budget and links to budget entry

---

**P1.15 — History > Competition**

- YoY occupancy and ADR change summary
- Line chart: property vs named competitors, toggleable: Occupancy / ADR / RevPAR
- Competition table: HOTEL NAME / RATE / TOTAL ROOMS / AVAIL ROOMS / DAILY OCC / MTD AVAIL / MTD OCCUPANCY

**Acceptance Criteria:**
- Line chart renders only competitors with ≥ 7 days of data in the selected period
- Competitors are configured in Property Settings during onboarding; at least one competitor must be defined before this view is accessible
- If no competition data exists for the selected period, view shows a clear empty state with a prompt to add data
- Competition table is sortable by MTD OCCUPANCY and RATE

---

**P1.16 — History > Payments**

- YoY growth summary (MTD and YTD)
- Donut charts: Today / MTD / YTD by payment type
- Payments table: PAYMENT TYPE / TODAY / MTD / YTD

Payment types: AMEX, Cash, Interac, Mastercard, VISA, Check, Direct Bill, Discover. Additional types can be added per property in settings.

**Acceptance Criteria:**
- All configured payment types appear in the table; inactive types show $0
- Donut chart segments are labeled with both type name and percentage
- YoY change is displayed if prior year data exists

---

#### 6.6 Forecast

---

**P1.17 — Forecast Chart**

4-line chart: Last Year / Forecast / Current / Budget. Toggleable by: RevPAR / Rooms / ADR / Occupancy.

**Acceptance Criteria:**
- All four lines render for properties with LY data and a set budget
- Missing lines (no LY data, no budget) are omitted and labeled in the legend as "Not available"
- Toggle between metrics updates chart within 500ms without page reload
- Chart x-axis spans the full current month; current date is marked with a vertical indicator

---

**P1.18 — Demand-Weighted Revenue Projection**

OTB rooms + LY pickup pace curve → projected month-end revenue total. Displayed as three values: Forecast / Budget / LY.

**Acceptance Criteria:**
- Projection displays for all dates from current date through month end
- Projection recalculates automatically when new pace data is received (new nightly submission)
- If LY pace data is unavailable, forecast uses flat remaining OTB with a warning label
- All three values (Forecast / Budget / LY) are displayed together for direct comparison

---

**P1.19 — Day-by-Day Forecast Table**

Columns: DATE / PACE (TY, LY, NET) / ROOMS (Current, Forecast, Budget) / RATE (Current, Budget) / NOTIFICATION

**Acceptance Criteria:**
- Table renders for all dates from current date through end of current month
- PACE NET column = TY rooms on books minus LY rooms on books at same advance point
- NOTIFICATION column displays pickup alerts (P1.22) for flagged dates
- Rows with active alerts are highlighted

---

**P1.20 — Interactive Budget Controls**

Adjustable Budget Occupancy and Budget ADR inputs. Forecast recalculates in real time. ADR on Booked Rooms vs ADR Target on Forecasted Rooms displayed.

**Acceptance Criteria:**
- Adjusting Budget Occupancy input recalculates Budget RevPAR and Revenue within 500ms
- Adjusting Budget ADR input recalculates Budget Revenue within 500ms
- Interactive adjustments are temporary (session only) — they do not overwrite saved budget data
- A "Save as budget" button explicitly persists the adjusted values if the user chooses to

---

**P1.21 — LY vs TY Pace Overlay**

Color-coded gap indicator per date in the forecast table PACE column.

- 🟢 Green — TY rooms on books ≥ LY at same point in advance
- 🟡 Yellow — TY is 1–10% behind LY (default threshold; configurable per property)
- 🔴 Red — TY is > 10% behind LY

**Acceptance Criteria:**
- Color indicators render on all dates with LY comparison data available
- Dates without LY data show "—" in the LY PACE column, no color indicator
- Thresholds are configurable per property in Settings (default: yellow at -1% to -10%, red at < -10%)

---

**P1.22 — Pickup Velocity Alert**

Flags future dates where the 7-day pickup rate has dropped below 50% of the LY pickup rate at the same point in advance.

**Acceptance Criteria:**
- Alert fires when a date's trailing 7-day pickup rate falls below 50% of LY at equivalent advance window (default threshold; configurable)
- Alert appears in NOTIFICATION column of forecast table within 24 hours of threshold crossing
- Alert also appears as a badge on the property in the portfolio sidebar
- Alert includes: the flagged date, current pickup rate, LY pickup rate at same point, gap percentage

---

#### 6.7 Budget

---

**P1.23 — Monthly Budget Entry**

Per property / per month / per revenue category. Annual budget broken into monthly targets.

**Acceptance Criteria:**
- Budget can be entered at the category level for each month of the fiscal year
- Total annual budget can be entered with seasonal distribution options: equal split / LY distribution / manual monthly entry
- Budget data feeds: forecast chart budget line, overview progress bars, and variance alert engine
- Budget can be edited at any time; changes take effect immediately in all views
- Budget is importable from a CSV template (columns: category, month, amount)

---

**P1.24 — Rolling Re-Forecast**

Three lines tracked simultaneously: Original Budget / Rolling Forecast / Actuals. Monthly view shows all three columns per category.

**Acceptance Criteria:**
- Original Budget column reflects the budget at fiscal year start and is read-only once the year begins
- Rolling Forecast updates automatically each time new actuals are received
- Monthly budget view table shows all three columns (Original Budget / Rolling Forecast / Actuals) side by side
- Variance between Rolling Forecast and Original Budget is displayed as a delta column

---

#### 6.8 Alerts & Notifications

---

**P1.25 — Variance Alert Engine**

Triggers when property RevPAR drops X% below budget for N consecutive days. Configurable per property.

**Acceptance Criteria:**
- Alert fires when RevPAR falls below budget by ≥ X% for ≥ N consecutive days (defaults: X = 10%, N = 3)
- X and N are configurable per property in Settings
- Alert is delivered as an in-app notification and badge on the portfolio sidebar
- Alert can be dismissed by the user; dismissal is logged with timestamp and user
- The same alert condition does not re-fire until it is resolved and re-triggered

---

**P1.26 — Alert with Explanation + Recommended Action**

Every alert includes three components: signal, context, and suggested action.

Example:
1. **Signal:** *"Riverport RevPAR is 12% below budget"*
2. **Context:** *"Pickup for March 15–22 is tracking 18% behind LY at same point in advance"*
3. **Action:** *"Consider dropping rate on March 17–18 to stimulate pickup"*

Note: RevParMax surfaces recommendations only. Rate execution requires the owner to act in their PMS or OTA. This is intentional — RevParMax is an analytics layer, not a channel manager.

**Acceptance Criteria:**
- Every alert includes all three components: signal, context (with specific dates and numbers), suggested action
- Suggested action text is generated from the underlying data, not static copy
- Alert detail view links directly to the relevant forecast date range
- Alerts without sufficient data for a context or action display signal only with a note explaining why

---

#### 6.9 Attachments

---

**P1.27 — File Management**

Date-contextual file list. Files are attached to the audit date they were submitted for.

**Acceptance Criteria:**
- Files attached via nightly upload are visible in the context of their audit date
- Files can be downloaded in their original format
- Files follow naming convention from P1.7
- File list is filterable by date range and file type
- Maximum file retention: 7 years (see Section 5, Data Retention)

---

### Phase 2 — Intelligence & Experience Layer

#### Forecasting Enhancements
- **P2.1** Smart LY — flags anomaly years (COVID, local events), offers normalized LY curve alongside raw LY
- **P2.2** Demand Heatmap Calendar — 12-month calendar view, colored by occupancy intensity
- **P2.3** Forecast Confidence Intervals — displayed as range: *"$385K–$438K (80% confidence)"*
- **P2.4** Rate Calendar — interactive day-by-day rate planning within forecast view
- **P2.5** Weighted Pace Blending — blend 1-year / 2-year / AI-selected pace for forecast

#### Budget & Planning
- **P2.6** Conversational Budget Setting — *"I want $4M this year, heavier in Q3"* → AI proposes monthly distribution; owner reviews and confirms
- **P2.7** Smart Budget Proposal — AI analyzes 3 years of history, proposes a realistic budget with reasoning
- **P2.8** Outcome-First Budget — enter desired revenue outcome, system works backward to required pace and ADR
- **P2.9** Capacity-Adjusted Budget — OOO rooms automatically recalculate available room-nights and budget targets

#### AI & Natural Language Interface
- **P2.10** Natural Language Query — *"How did March track vs last year?"* answered with specific numbers
- **P2.11** Forecast Explainer — *"Why is March forecast lower than budget?"* with breakdown
- **P2.12** Scenario Conversation — *"What if ADR drops $15 this weekend?"* with real-time math
- **P2.13** Exceptions-Only Dashboard Default — surface only what needs attention; full data one click away

#### Competitive Intelligence
- **P2.14** OTA Rate Scraper — nightly pull of competitor rates from public OTA pages
- **P2.15** Demand Signal Calendar — local events overlaid on pace calendar from public APIs
- **P2.16** Flash Opportunity Alert — competitor raises rates → immediate push notification

#### UX Enhancements
- **P2.17** Configurable KPI Tiles — drag-and-drop metric selection per ownership group
- **P2.18** Portfolio Heat Map — properties × months grid, colored by performance vs budget
- **P2.19** Financial Health Score — single 0–100 score per property, updated daily
- **P2.20** Weekly Digest Email — Monday plain-English summary, no login required
- **P2.21** Property-to-Property Benchmarking — internal comparison within ownership portfolio

#### Reporting
- **P2.22** One-Click Board Report — polished PDF: portfolio summary, property breakdown, narrative
- **P2.23** Performance Narrative Generator — any view → plain-English paragraph in one click
- **P2.24** Saved Views — named report configurations (Board Meeting View, Weekly Ops View)

#### Integrations
- **P2.25** Opera OHIP Connector — direct API pull for Opera Cloud properties (eliminates night auditor submission entirely)
- **P2.26** PMS Pull Mode — RevParMax pulls data nightly for connected properties

---

### Phase 3 — Network, Mobile & Advanced Intelligence

- **P3.1** Mobile Portfolio Pulse — property cards, push alerts, one-tap drill-down (iOS + Android)
- **P3.2** Market Pulse — anonymized aggregate pace across all RevParMax clients in a market (network intelligence)
- **P3.3** Shared Event Intelligence — one client's event annotation informs all clients in that market
- **P3.4** Price Elasticity Memory — learns property's demand curve from historical rate/pickup data
- **P3.5** Bear/Base/Bull Scenario Band — three forecast scenarios displayed as a confidence band
- **P3.6** Annual Property Wrapped — year-end visual story, shareable, presentation-ready
- **P3.7** Raw Data API — read-only API for accountants and asset managers
- **P3.8** RevPAR Yield vs Asset Value — connects ops data to investment performance thesis
- **P3.9** Browser Extension OTA Harvester — captures OTA data from authenticated partner portals

---

## 7. Non-Functional Requirements

### Performance
- Dashboard initial load to readable state: < 2 seconds
- AI extraction pipeline: < 30 seconds for standard PMS report (PDF ≤ 10 pages / ≤ 5 MB)
- Real-time budget recalculation (interactive controls): < 500ms
- Chart toggle (metric switch): < 500ms without page reload

### Reliability
- Data ingestion pipeline: 99.9% uptime — nightly submissions must never fail silently
- Failed ingestion: the submitting user receives an in-app error with retry instructions; property admin is alerted within 15 minutes if submission remains unresolved
- Ingestion failures are logged with: file name, failure reason, timestamp, and user

### Security & Data
- All property data is tenant-isolated — no cross-property data access
- Night auditor accounts are scoped to a single property; they cannot access other properties in the group
- File uploads are scanned for malware before extraction
- Market Pulse (Phase 3) uses anonymized, aggregated data only — individual property data is never exposed to other clients

### Accessibility
- WCAG 2.1 AA compliance for all owner-facing UI
- Dashboard usable on tablet (minimum 768px viewport)

### Scalability
- Architecture supports 500+ properties without schema changes
- Living Snapshot storage: ~900K rows/year at 500 properties — no archival strategy required in Phase 1

---

## 8. Out of Scope

The following are explicitly excluded:

- **Multi-currency** — USD only in V1
- **Channel management / rate pushing** — RevParMax surfaces rate recommendations; execution is the owner's responsibility in their PMS or OTA. This is by design.
- **Guest-facing features** — no booking engine, no CRM, no loyalty program
- **Full PMS replacement** — RevParMax is an analytics and forecasting layer over existing PMS data
- **Large enterprise chains (50+ properties)** — not the target segment; architecture should not over-engineer for this scale
- **Email-in ingestion** — reports are submitted by logged-in users only; no anonymous inbound email pipeline

---

## 9. Phase 1 Build Sequence

Ordered by dependency:

1. Self-serve onboarding + property setup (P1.1–P1.2)
2. Nightly report submission — logged-in upload (P1.3)
3. Universal AI ingestion + verify flow + failure modes (P1.4–P1.6)
4. Auto-named attachments + file management (P1.7, P1.27)
5. Bulk historical backfill (P1.8)
6. Manual data entry fallback (P1.9)
7. Portfolio sidebar + navigation (P1.10–P1.11)
8. Owner overview dashboard (P1.12)
9. Historical reporting — all four views (P1.13–P1.16)
10. Forecast engine + pace overlay + pickup alerts (P1.17–P1.22)
11. Budget module + rolling re-forecast (P1.23–P1.24)
12. Variance alerts with explanation + action (P1.25–P1.26)

---

## 10. Open Questions

| # | Question | Owner | Priority |
|---|----------|-------|----------|
| 1 | What is the primary PMS target for AI extraction spike? (Opera PNL report suspected based on existing backup folder) | Product | P1 |
| 2 | What is the confidence threshold for auto-approval vs yellow flag? (suggested default: 92%) | Product | P1 |
| 3 | Which payment types are universal vs property-configurable? | Product | P1 |
| 4 | How many years of historical backfill should onboarding support? | Product | P1 |
| 5 | What is the pricing model — per property/month, or per ownership group? | Business | P1 |
| 6 | Is there an existing customer whose data can be used for AI extraction testing and accuracy baseline? | Product | P1 |
| 7 | What is the night auditor account provisioning flow? Does the GM create their account, or does the auditor self-register with a property invite code? | Product | P1 |
| 8 | What is the anomaly threshold for Smart LY (P2.1) to flag a year? (e.g., occupancy < 50% for ≥ 30 days) | Product | P2 |

---

*v1.1 — Updated from adversarial review: removed email-in ingestion, clarified night auditor role as upload+verify only, added ingestion failure flows, added acceptance criteria to all P1 requirements, moved conversational budget to P2, fixed forecast accuracy metric, added data retention policy, clarified rate recommendation scope in Out of Scope.*

*Generated by BMad Master from brainstorming session `_bmad-output/brainstorming/brainstorming-session-2026-03-03-2014.md`*
