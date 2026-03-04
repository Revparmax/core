"use node";

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import pdfParse from "pdf-parse";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

// TODO: Replace this stub with real GuardDuty submission (ADR-012).
// GuardDuty delivers findings asynchronously via SNS → EventBridge → webhook.
// For MVP, immediately mark every upload as clean and proceed to extraction.
export const runMalwareScan = internalAction({
  args: { importId: v.id("dataImports") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.uploads.internalMutations.markScanResult, {
      importId: args.importId,
      result: "clean",
    });
  },
});

// ── helpers ────────────────────────────────────────────────────────────────────

interface ExtractionField {
  confidence: number;
  sourceText: string;
  value: string | number | null;
}

interface ExtractionResult {
  auditDate: string | null;
  competition: Array<{
    competitorName: string;
    rate: number | null;
    availableRooms: number | null;
    dailyOccupancy: number | null;
    confidence: number;
  }>;
  extractionStatus: "success" | "partial" | "failed" | "image_pdf";
  fields: {
    roomsOccupied: ExtractionField;
    adr: ExtractionField;
    sameDayCancellations: ExtractionField;
    noShows: ExtractionField;
    compRooms: ExtractionField;
    oooRooms: ExtractionField;
  };
  nonRoomRevenue: Array<{
    sourceLabel: string;
    proposedCategoryId: string | null;
    amount: number;
    confidence: number;
  }>;
  paceSnapshot: Array<{
    forecastDate: string;
    roomsOnBooks: number;
    adr: number | null;
    confidence: number;
  }>;
  payments: Array<{
    paymentType: string;
    amount: number;
    confidence: number;
  }>;
  reportType: string | null;
}

async function parsePdf(blob: Blob): Promise<string | null> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const parsed = await pdfParse(buffer);
  return parsed.text ?? null;
}

function parseXlsx(buffer: Buffer): string {
  const workbook = xlsxRead(buffer);
  let bestSheet = "";
  let bestCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = xlsxUtils.sheet_to_csv(sheet);
    const numericCount = (csv.match(/\d/g) ?? []).length;
    if (numericCount > bestCount) {
      bestCount = numericCount;
      bestSheet = csv;
    }
  }

  return bestSheet;
}

// Rough token estimate: ~4 chars per token.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function callClaude(
  client: Anthropic,
  systemPrompt: string,
  fileContent: string
): Promise<ExtractionResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Extract structured data from this hotel PMS report:\n\n${fileContent}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  // Strip markdown code fences if present.
  const raw = textBlock.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  return JSON.parse(raw) as ExtractionResult;
}

const RETRY_DELAYS = [2000, 4000, 8000] as const;

async function callClaudeWithRetry(
  client: Anthropic,
  systemPrompt: string,
  fileContent: string,
  attempt = 0
): Promise<ExtractionResult> {
  try {
    return await callClaude(client, systemPrompt, fileContent);
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    const isRetryable = status === 429 || status === 503;

    if (!isRetryable || attempt >= RETRY_DELAYS.length) {
      throw err;
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, RETRY_DELAYS[attempt])
    );

    return callClaudeWithRetry(client, systemPrompt, fileContent, attempt + 1);
  }
}

const EXTRACTION_SYSTEM_PROMPT_TEMPLATE = `You are a hotel PMS report parser. Extract structured financial data from the provided hotel audit report.

PROPERTY CONTEXT:
- Property name: {PROPERTY_NAME}
- Total rooms: {TOTAL_ROOMS}
- Revenue categories: {CATEGORIES}
- Known label mappings: {MAPPINGS}
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
8. Parenthesized amounts represent negative values: (1,234.56) must be extracted as -1234.56.

OUTPUT: Respond ONLY with valid JSON matching the schema below. No prose.

{
  "auditDate": "YYYY-MM-DD or null",
  "reportType": "night-audit | daily-report | report | null",
  "extractionStatus": "success | partial | failed | image_pdf",
  "fields": {
    "roomsOccupied": { "value": number_or_null, "confidence": 0_to_1, "sourceText": "verbatim text" },
    "adr": { "value": number_or_null, "confidence": 0_to_1, "sourceText": "verbatim text" },
    "sameDayCancellations": { "value": number_or_null, "confidence": 0_to_1, "sourceText": "verbatim text" },
    "noShows": { "value": number_or_null, "confidence": 0_to_1, "sourceText": "verbatim text" },
    "compRooms": { "value": number_or_null, "confidence": 0_to_1, "sourceText": "verbatim text" },
    "oooRooms": { "value": number_or_null, "confidence": 0_to_1, "sourceText": "verbatim text" }
  },
  "paceSnapshot": [{ "forecastDate": "YYYY-MM-DD", "roomsOnBooks": number, "adr": number_or_null, "confidence": 0_to_1 }],
  "nonRoomRevenue": [{ "sourceLabel": "string", "proposedCategoryId": "string_or_null", "amount": number, "confidence": 0_to_1 }],
  "payments": [{ "paymentType": "string", "amount": number, "confidence": 0_to_1 }],
  "competition": [{ "competitorName": "string", "rate": number_or_null, "availableRooms": number_or_null, "dailyOccupancy": number_or_null, "confidence": 0_to_1 }]
}`;

// ── extracted helpers (reduce handler cognitive complexity) ────────────────────

// Returns the parsed text content of a file, or null for image PDFs.
// Throws on storage/parse errors so the caller can handle.
async function extractFileContent(
  blob: Blob,
  mimeType: string
): Promise<string | null> {
  if (mimeType === "application/pdf") {
    const text = await parsePdf(blob);
    // Scanned image PDF — fewer than 50 chars means no extractable text (8a spec).
    if (!text || text.length < 50) {
      return null;
    }
    return text;
  }

  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    return parseXlsx(buffer);
  }

  return blob.text();
}

// Builds the Claude system prompt, applying IN-011 token truncation.
function buildSystemPrompt(
  property: { name: string; totalRooms: number } | null,
  categories: Array<{ _id: string; name: string }>,
  extractorProfile: { mappings: Record<string, string> } | null,
  fileContent: string
): string {
  // IN-011: Truncate mappings if combined prompt would exceed ~150k tokens.
  let mappings: Record<string, string> = extractorProfile?.mappings ?? {};
  const baseTokens = estimateTokens(
    `${property?.name ?? ""}${property?.totalRooms ?? ""}${JSON.stringify(categories)}${fileContent}`
  );

  if (baseTokens + estimateTokens(JSON.stringify(mappings)) > 150_000) {
    mappings = Object.fromEntries(Object.entries(mappings).slice(-200));
  }

  return EXTRACTION_SYSTEM_PROMPT_TEMPLATE.replace(
    "{PROPERTY_NAME}",
    property?.name ?? "Unknown"
  )
    .replace("{TOTAL_ROOMS}", String(property?.totalRooms ?? "Unknown"))
    .replace(
      "{CATEGORIES}",
      JSON.stringify(categories.map((c) => ({ name: c.name, id: c._id })))
    )
    .replace("{MAPPINGS}", JSON.stringify(mappings));
}

const EMPTY_RESULT = {
  extractedFields: [] as Array<{
    field: string;
    value: string | number | null;
    confidence: number;
    label: string;
  }>,
  proposedMappings: [] as Array<{
    sourceLabel: string;
    proposedCategoryId: string | null;
    amount: number;
    confidence: number;
  }>,
  payments: [] as Array<{
    paymentType: string;
    amount: number;
    confidence: number;
  }>,
  paceSnapshot: [] as Array<{
    forecastDate: string;
    roomsOnBooks: number;
    adr: number | null;
    confidence: number;
  }>,
};

// ── main extraction action ─────────────────────────────────────────────────────

export const runExtraction = internalAction({
  args: { importId: v.id("dataImports") },
  handler: async (ctx, args) => {
    const markFailed = async (status: "failed" | "timeout" = "failed") =>
      ctx.runMutation(internal.uploads.internalMutations.markExtractionResult, {
        importId: args.importId,
        status,
        ...EMPTY_RESULT,
      });

    const dataImport = await ctx.runQuery(
      internal.uploads.internalQueries.getImportForExtraction,
      { importId: args.importId }
    );

    if (!dataImport?.storageId) {
      await markFailed();
      return;
    }

    await ctx.runMutation(
      internal.uploads.internalMutations.setExtractionInProgress,
      { importId: args.importId }
    );

    // Parse file content.
    let fileContent: string;
    try {
      const blob = await ctx.storage.get(dataImport.storageId);
      if (!blob) {
        throw new Error("File not found in storage");
      }
      const content = await extractFileContent(blob, dataImport.mimeType);
      if (content === null) {
        // Image PDF — no extractable text.
        await markFailed();
        return;
      }
      fileContent = content;
    } catch {
      await markFailed();
      return;
    }

    // Build prompt with property context.
    const { property, categories, extractorProfile } = await ctx.runQuery(
      internal.uploads.internalQueries.getExtractionContext,
      { propertyId: dataImport.propertyId }
    );

    const systemPrompt = buildSystemPrompt(
      property,
      categories,
      extractorProfile,
      fileContent
    );

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await markFailed();
      return;
    }

    // Call Claude with 30s hard timeout (IN-003).
    let result: ExtractionResult;
    try {
      result = await Promise.race([
        callClaudeWithRetry(
          new Anthropic({ apiKey }),
          systemPrompt,
          fileContent
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 90_000)
        ),
      ]);
    } catch (err) {
      await markFailed(
        err instanceof Error && err.message === "timeout" ? "timeout" : "failed"
      );
      return;
    }

    const extractedFields = Object.entries(result.fields).map(
      ([field, ef]) => ({
        field,
        value: ef.value,
        confidence: ef.confidence,
        label: field,
      })
    );

    await ctx.runMutation(
      internal.uploads.internalMutations.markExtractionResult,
      {
        importId: args.importId,
        status: "ready_for_verify",
        auditDate: result.auditDate ?? undefined,
        reportType: result.reportType ?? undefined,
        extractedFields,
        proposedMappings: result.nonRoomRevenue.map((r) => ({
          sourceLabel: r.sourceLabel,
          proposedCategoryId: r.proposedCategoryId,
          amount: r.amount,
          confidence: r.confidence,
        })),
        payments: result.payments.map((p) => ({
          paymentType: p.paymentType,
          amount: p.amount,
          confidence: p.confidence,
        })),
        paceSnapshot: result.paceSnapshot.map((s) => ({
          forecastDate: s.forecastDate,
          roomsOnBooks: s.roomsOnBooks,
          adr: s.adr ?? null,
          confidence: s.confidence,
        })),
      }
    );
  },
});
