# 8a. AI Extraction Specification

> **Previously absent — added in v1.1 to address adversarial finding #5.**

## Claude System Prompt Structure

```
You are a hotel PMS report parser. Extract structured financial data from the provided hotel audit report.

PROPERTY CONTEXT:
- Property name: {property.name}
- Total rooms: {property.totalRooms}
- Revenue categories: {categories[].name} (IDs: {categories[].id})
- Known label mappings: {JSON.stringify(extractorProfile.mappings)}
  (Format: { "source label from PMS": "categoryId" })

EXTRACTION INSTRUCTIONS:
1. Identify the audit date. Look for patterns: "Date:", "Night of:", "Report Date:", "For the Night of".
   If no date is found, set auditDate to null.
2. Identify the report type. Common values: "night-audit", "daily-report". Default to "report" if unclear.
3. Extract all numeric fields per the output schema below.
4. For each revenue line item:
   a. Check if its label (case-insensitive) matches a key in the known label mappings.
      If matched: set confidence to 1.0 and use the mapped categoryId.
   b. If not matched: propose the closest revenue category by semantic similarity.
      Set confidence < 0.92 to trigger user review.
   c. If no category fits: set proposedCategoryId to null and confidence to 0.
5. If a field is not present in the document: set value to null and confidence to 0.
6. Extract pace data: the forward booking table (rooms on books by future date).
   This is typically a table with columns: Date | Rooms On Books | ADR (or similar).
   Extract all rows up to 365 days forward.
7. If the document appears to be a scanned image (no extractable text),
   set extractionStatus to "image_pdf" and all field values to null.
8. Parenthesized amounts represent negative values: (1,234.56) must be extracted as -1234.56. (IN-022)

OUTPUT: Respond ONLY with valid JSON matching the schema below. No prose.
```

> **IN-011 (v1.2):** Before calling Claude, estimate token count of the assembled prompt. If estimated tokens exceed 150,000, truncate `extractorProfile.mappings` to the most-recently-confirmed 200 label entries and add a truncation warning to the extraction result. This prevents context-length errors for mature properties with extensive mapping history.

## Output JSON Schema

```typescript
type ExtractionField<T> = {
  value: T | null;
  confidence: number;   // 0.0–1.0; >= 0.92 auto-confirmed (green), < 0.92 needs review (yellow), 0 = not found (red)
  sourceText: string;   // verbatim text from document that produced this extraction
};

type ExtractionResult = {
  auditDate: string | null;          // "YYYY-MM-DD"
  reportType: string | null;         // "night-audit" | "daily-report" | "report"
  extractionStatus: "success" | "partial" | "failed" | "image_pdf";
  fields: {
    roomsOccupied: ExtractionField<number>;
    adr: ExtractionField<number>;
    sameDayCancellations: ExtractionField<number>;
    noShows: ExtractionField<number>;
    compRooms: ExtractionField<number>;
    oooRooms: ExtractionField<number>;
  };
  paceSnapshot: Array<{
    forecastDate: string;            // "YYYY-MM-DD"
    roomsOnBooks: number;
    adr: number | null;
    confidence: number;
  }>;
  nonRoomRevenue: Array<{
    sourceLabel: string;             // raw label from document
    proposedCategoryId: string | null;
    amount: number;
    confidence: number;
  }>;
  payments: Array<{
    paymentType: string;             // normalized: "VISA", "AMEX", "Cash", etc.
    amount: number;
    confidence: number;
  }>;
  competition: Array<{
    competitorName: string;
    rate: number | null;
    availableRooms: number | null;
    dailyOccupancy: number | null;   // 0.0–1.0
    confidence: number;
  }>;
};
```

## Extractor Profile Injection

The property's `extractorProfile.mappings` (`Record<sourceLabel, categoryId>`) is serialized and embedded in the system prompt at extraction time. The LLM uses it to auto-confirm known labels at confidence 1.0. This eliminates re-review for recurring PMS vocabulary after the first confirmed upload.

On confirmation in the verify flow, any corrected or newly mapped label is written back to `extractorProfile.mappings` via `confirmVerify` mutation — closing the learning loop. The mutation uses **patch** (not replace) to safely merge new labels without clobbering concurrent writes (IN-012).

> **IN-001 (v1.2):** Before writing any label→categoryId entry to `extractorProfile.mappings`, validate that the value is a valid `Id<"revenueCategories">` belonging to the same property. If the value fails validation (e.g. malformed ID from a verify bug), throw `ConvexError('Bad mapping')` and skip the write rather than persisting corrupt data into the system prompt.

## Scanned Image Handling

If `pdf-parse` extracts fewer than 50 characters of text from a PDF:
1. Flag document as `image_pdf` — skip Claude call entirely (saves token cost)
2. Save `extractionResults` with `status: "failed"`, `extractedFields: []`
3. Frontend routes to full failure flow (P1.5): file preview + message "This appears to be a scanned image. Please enter data manually." + manual entry option

**No OCR is attempted in Phase 1.** OCR support (Tesseract or AWS Textract) is a Phase 2 enhancement.

## File Parsing by Type

| Format | Parser | Notes |
|---|---|---|
| PDF | `pdf-parse` (npm) | Text extraction only; image PDFs detected by char count < 50 |
| XLSX / XLS | `xlsx` (SheetJS) | Iterate all sheets; select sheet with highest numeric cell count or concatenate all (IN-010) |
| CSV | Native string | Passed directly to Claude with delimiter detection |

All parsing runs inside the Convex `runExtraction` action before the Claude call.

---
