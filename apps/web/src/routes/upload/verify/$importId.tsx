import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/upload/verify/$importId")({
  component: VerifyPage,
});

// ── constants ──────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.92;
const ISO_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const MAX_AUDIT_DATE_YEARS_AGO = 7;

const FIELD_LABELS: Record<string, string> = {
  roomsOccupied: "Rooms Occupied",
  adr: "ADR ($)",
  sameDayCancellations: "Same-Day Cancellations",
  noShows: "No-Shows",
  compRooms: "Complimentary Rooms",
  oooRooms: "Out of Order Rooms",
};

const FIELD_ORDER = [
  "roomsOccupied",
  "adr",
  "sameDayCancellations",
  "noShows",
  "compRooms",
  "oooRooms",
] as const;

// ── types ──────────────────────────────────────────────────────────────────────

type ConfidenceLevel = "green" | "yellow" | "red";

interface Category {
  _id: string;
  name: string;
}

interface MappingState {
  amount: number;
  confidence: number;
  proposedCategoryId: string | null;
  selectedCategoryId: string | null;
  skipped: boolean;
  sourceLabel: string;
}

interface ExtractedField {
  confidence: number;
  field: string;
  label: string;
  value: string | number | null;
}

interface PaymentEntry {
  amount: number;
  confidence: number;
  paymentType: string;
}

interface ProposedMapping {
  amount: number;
  confidence: number;
  proposedCategoryId: string | null;
  sourceLabel: string;
}

interface VerifyDataShape {
  categories: Category[];
  dataImport: {
    _id: Id<"dataImports">;
    originalFilename: string;
    mimeType: string;
  };
  extractionResult: {
    status: string;
    auditDate?: string;
    reportType?: string;
    extractedFields: ExtractedField[];
    proposedMappings: ProposedMapping[];
    payments: PaymentEntry[];
    paceSnapshot: Array<{
      forecastDate: string;
      roomsOnBooks: number;
      adr: number | null;
      confidence: number;
    }>;
  };
  fileUrl: string | null;
  property: { name: string; timezone: string } | null;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function getConfidenceLevel(
  confidence: number,
  value: string | number | null | undefined
): ConfidenceLevel {
  if (value == null || confidence === 0) {
    return "red";
  }
  if (confidence >= CONFIDENCE_THRESHOLD) {
    return "green";
  }
  return "yellow";
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function getDateWarning(dateStr: string): string | null {
  if (!ISO_DATE_REGEX.test(dateStr)) {
    return null;
  }
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (date > now) {
    return "This date is in the future.";
  }
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - MAX_AUDIT_DATE_YEARS_AGO);
  if (date < cutoff) {
    return `This date is more than ${MAX_AUDIT_DATE_YEARS_AGO} years in the past.`;
  }
  return null;
}

// ── pure sub-components (no state, no hooks) ───────────────────────────────────

function ConfidencePip({ level }: { level: ConfidenceLevel }) {
  const colors: Record<ConfidenceLevel, string> = {
    green: "bg-green-500",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };
  return (
    <span
      aria-label={`Confidence: ${level}`}
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${colors[level]}`}
      role="img"
    />
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
      {children}
    </h3>
  );
}

function ReconciliationBanner({
  revenueTotal,
  paymentsTotal,
}: {
  revenueTotal: number;
  paymentsTotal: number;
}) {
  const diff = Math.abs(revenueTotal - paymentsTotal);
  if (diff < 1) {
    return null;
  }
  return (
    <div
      className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
      role="alert"
    >
      <span className="font-medium">Reconciliation warning: </span>Revenue (
      {formatCurrency(revenueTotal)}) does not match payments (
      {formatCurrency(paymentsTotal)}). Difference: {formatCurrency(diff)}.
    </div>
  );
}

function FilePreview({
  fileUrl,
  filename,
  mimeType,
}: {
  fileUrl: string | null;
  filename: string;
  mimeType: string;
}) {
  const isPdf = mimeType === "application/pdf";
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 truncate px-1 text-muted-foreground text-xs">
        {filename}
      </p>
      {isPdf && fileUrl ? (
        <iframe
          className="min-h-[400px] flex-1 rounded border"
          src={fileUrl}
          title={`Preview of ${filename}`}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded border border-dashed bg-muted/30 p-8 text-center">
          <div>
            <p className="font-medium text-sm">{filename}</p>
            <p className="mt-1 text-muted-foreground text-xs">
              {fileUrl
                ? "Preview not available for this file type."
                : "File preview unavailable."}
            </p>
            {fileUrl && (
              <a
                className="mt-2 inline-block text-primary text-xs underline"
                href={fileUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Download file
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomStatRow({
  fieldKey,
  originalConfidence,
  originalValue,
  confirmed,
  editValue,
  onEdit,
  onConfirm,
}: {
  fieldKey: string;
  originalConfidence: number;
  originalValue: string | number | null;
  confirmed: boolean;
  editValue: string;
  onEdit: (val: string) => void;
  onConfirm: () => void;
}) {
  const level = getConfidenceLevel(originalConfidence, originalValue);
  const label = FIELD_LABELS[fieldKey] ?? fieldKey;
  const resolvedLevel = level === "yellow" && confirmed ? "green" : level;

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <ConfidencePip level={resolvedLevel} />
      <Label className="w-44 shrink-0 text-xs" htmlFor={`field-${fieldKey}`}>
        {label}
      </Label>
      <Input
        className="h-7 w-28 text-xs"
        id={`field-${fieldKey}`}
        onBlur={onConfirm}
        onChange={(e) => onEdit(e.target.value)}
        step="any"
        type="number"
        value={editValue}
      />
      {level === "yellow" && !confirmed && (
        <Button
          className="h-6 px-2 text-xs"
          onClick={onConfirm}
          type="button"
          variant="outline"
        >
          Confirm
        </Button>
      )}
      {originalConfidence > 0 && level !== "red" && (
        <span className="text-muted-foreground text-xs">
          {Math.round(originalConfidence * 100)}%
        </span>
      )}
    </div>
  );
}

function RevenueMappingRow({
  state,
  categories,
  onCategoryChange,
  onToggleSkip,
}: {
  state: MappingState;
  categories: Category[];
  onCategoryChange: (categoryId: string | null) => void;
  onToggleSkip: () => void;
}) {
  const level = getConfidenceLevel(state.confidence, state.proposedCategoryId);
  const isResolved =
    state.skipped || level === "green" || state.selectedCategoryId !== null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 py-2 text-xs ${state.skipped ? "opacity-50" : ""}`}
    >
      <ConfidencePip level={isResolved ? "green" : level} />
      <span className="w-36 shrink-0 truncate font-medium">
        {state.sourceLabel}
      </span>
      <span className="w-24 shrink-0 text-right text-muted-foreground">
        {formatCurrency(state.amount)}
      </span>
      {!state.skipped && (
        <select
          aria-label={`Revenue category for ${state.sourceLabel}`}
          className="h-7 flex-1 rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-1 dark:bg-input/30"
          onChange={(e) =>
            onCategoryChange(e.target.value === "" ? null : e.target.value)
          }
          value={state.selectedCategoryId ?? ""}
        >
          <option value="">— Select category —</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>
      )}
      <Button
        className="h-6 shrink-0 px-2 text-xs"
        onClick={onToggleSkip}
        type="button"
        variant="ghost"
      >
        {state.skipped ? "Undo skip" : "Skip"}
      </Button>
    </div>
  );
}

function PaymentRow({
  paymentType,
  amount,
}: {
  paymentType: string;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-muted-foreground">{paymentType}</span>
      <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
    </div>
  );
}

// ── VerifyForm — receives loaded data, manages all form state ──────────────────

function VerifyForm({
  importId,
  verifyData,
}: {
  importId: Id<"dataImports">;
  verifyData: VerifyDataShape;
}) {
  const navigate = useNavigate();
  const confirmVerify = useMutation(api.uploads.mutations.confirmVerify);

  const { dataImport, extractionResult, property, categories, fileUrl } =
    verifyData;

  // Build field map once from the loaded data (stable across renders).
  const extractedFieldMap = useMemo(() => {
    const map: Record<
      string,
      { value: string | number | null; confidence: number }
    > = {};
    for (const f of extractionResult.extractedFields) {
      map[f.field] = { value: f.value, confidence: f.confidence };
    }
    return map;
  }, [extractionResult.extractedFields]);

  // ── local state (initialized from loaded data) ───────────────────────────────

  const [auditDate, setAuditDate] = useState(extractionResult.auditDate ?? "");

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const key of FIELD_ORDER) {
      const f = extractedFieldMap[key];
      init[key] = f?.value != null ? String(f.value) : "";
    }
    return init;
  });

  const [fieldConfirmed, setFieldConfirmed] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      for (const key of FIELD_ORDER) {
        const f = extractedFieldMap[key];
        init[key] =
          f !== undefined &&
          getConfidenceLevel(f.confidence, f.value) === "green";
      }
      return init;
    }
  );

  const [mappingStates, setMappingStates] = useState<MappingState[]>(() =>
    extractionResult.proposedMappings.map((m) => ({
      sourceLabel: m.sourceLabel,
      amount: m.amount,
      confidence: m.confidence,
      proposedCategoryId: m.proposedCategoryId,
      selectedCategoryId:
        getConfidenceLevel(m.confidence, m.proposedCategoryId) === "green"
          ? m.proposedCategoryId
          : null,
      skipped: false,
    }))
  );

  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── derived values ───────────────────────────────────────────────────────────

  const dateWarning = auditDate ? getDateWarning(auditDate) : null;
  const dateValid = ISO_DATE_REGEX.test(auditDate);

  const payments = extractionResult.payments;
  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  const roomRevenue = useMemo(() => {
    const rooms = Number(fieldValues.roomsOccupied);
    const adr = Number(fieldValues.adr);
    return Number.isNaN(rooms) || Number.isNaN(adr) ? 0 : rooms * adr;
  }, [fieldValues.roomsOccupied, fieldValues.adr]);

  const nonRoomRevenue = useMemo(
    () =>
      mappingStates
        .filter((m) => !m.skipped && m.selectedCategoryId !== null)
        .reduce((sum, m) => sum + m.amount, 0),
    [mappingStates]
  );

  const revenueTotal = roomRevenue + nonRoomRevenue;

  const allFieldsResolved = FIELD_ORDER.every((key) => {
    const f = extractedFieldMap[key];
    const level = getConfidenceLevel(f?.confidence ?? 0, f?.value ?? null);
    if (level === "red") {
      return fieldValues[key] !== "";
    }
    if (level === "yellow") {
      return fieldConfirmed[key] === true;
    }
    return true;
  });

  const allMappingsResolved = mappingStates.every(
    (m) =>
      m.skipped ||
      getConfidenceLevel(m.confidence, m.proposedCategoryId) === "green" ||
      m.selectedCategoryId !== null
  );

  const canSubmit =
    dateValid && allFieldsResolved && allMappingsResolved && !submitting;

  // ── handlers ─────────────────────────────────────────────────────────────────

  const handleConfirmField = useCallback((key: string) => {
    setFieldConfirmed((prev) => ({ ...prev, [key]: true }));
  }, []);

  const handleEditField = useCallback((key: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }));
    setFieldConfirmed((prev) => ({ ...prev, [key]: true }));
  }, []);

  const handleCategoryChange = useCallback(
    (index: number, categoryId: string | null) => {
      setMappingStates((prev) =>
        prev.map((m, i) =>
          i === index ? { ...m, selectedCategoryId: categoryId } : m
        )
      );
    },
    []
  );

  const handleToggleSkip = useCallback((index: number) => {
    setMappingStates((prev) =>
      prev.map((m, i) =>
        i === index
          ? { ...m, skipped: !m.skipped, selectedCategoryId: null }
          : m
      )
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setDuplicateWarning(null);

    const resolvedFields = {
      roomsOccupied: Number(fieldValues.roomsOccupied) || 0,
      adr: Number(fieldValues.adr) || 0,
      sameDayCancellations: Number(fieldValues.sameDayCancellations) || 0,
      noShows: Number(fieldValues.noShows) || 0,
      compRooms: Number(fieldValues.compRooms) || 0,
      oooRooms: Number(fieldValues.oooRooms) || 0,
    };

    const resolvedMappings = mappingStates
      .filter((m) => !m.skipped)
      .map((m) => ({
        sourceLabel: m.sourceLabel,
        categoryId: (m.selectedCategoryId ??
          null) as Id<"revenueCategories"> | null,
        amount: m.amount,
      }));

    try {
      await confirmVerify({
        importId,
        auditDate,
        overwriteConfirmed: overwriteConfirmed || undefined,
        resolvedFields,
        resolvedMappings,
      });

      toast.success("Audit data saved successfully.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.startsWith("DUPLICATE_AUDIT_DATE:")) {
        setDuplicateWarning(
          `An audit record already exists for ${auditDate}. Check the box below to overwrite it.`
        );
        setSubmitting(false);
        return;
      }
      toast.error(raw);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    fieldValues,
    mappingStates,
    auditDate,
    overwriteConfirmed,
    confirmVerify,
    importId,
    navigate,
  ]);

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link
          className="text-muted-foreground transition-colors hover:text-foreground"
          to="/dashboard"
        >
          Dashboard
        </Link>
        <span className="text-muted-foreground">/</span>
        <span>Verify extraction</span>
        {property && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">{property.name}</span>
          </>
        )}
      </div>

      {/* Confidence legend */}
      <div className="mb-4 flex flex-wrap gap-4 text-muted-foreground text-xs">
        <span className="flex items-center gap-1.5">
          <ConfidencePip level="green" /> Auto-confirmed (≥92%)
        </span>
        <span className="flex items-center gap-1.5">
          <ConfidencePip level="yellow" /> Needs confirmation (&lt;92%)
        </span>
        <span className="flex items-center gap-1.5">
          <ConfidencePip level="red" /> Not found — enter manually
        </span>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* File preview (desktop only) */}
        <Card className="hidden lg:block">
          <CardContent className="h-[calc(100vh-180px)] p-4">
            <FilePreview
              filename={dataImport.originalFilename}
              fileUrl={fileUrl}
              mimeType={dataImport.mimeType}
            />
          </CardContent>
        </Card>

        {/* Fields editor */}
        <div className="space-y-4">
          {/* Audit Date */}
          <Card>
            <CardHeader className="pt-4 pb-2">
              <CardTitle className="text-sm">Audit Date</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center gap-3">
                <Input
                  className="w-36"
                  id="audit-date"
                  onChange={(e) => setAuditDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  type="date"
                  value={auditDate}
                />
                {!dateValid && auditDate !== "" && (
                  <span className="text-destructive text-xs">
                    Invalid date format.
                  </span>
                )}
              </div>
              {dateWarning && (
                <p
                  className="mt-2 text-amber-600 text-xs dark:text-amber-400"
                  role="alert"
                >
                  ⚠ {dateWarning}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Room Statistics */}
          <Card>
            <CardHeader className="pt-4 pb-2">
              <CardTitle className="text-sm">Room Statistics</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <SectionHeading>Fields</SectionHeading>
              {FIELD_ORDER.map((key) => {
                const f = extractedFieldMap[key] ?? {
                  value: null,
                  confidence: 0,
                };
                return (
                  <RoomStatRow
                    confirmed={fieldConfirmed[key] ?? false}
                    editValue={fieldValues[key] ?? ""}
                    fieldKey={key}
                    key={key}
                    onConfirm={() => handleConfirmField(key)}
                    onEdit={(val) => handleEditField(key, val)}
                    originalConfidence={f.confidence}
                    originalValue={f.value}
                  />
                );
              })}
            </CardContent>
          </Card>

          {/* Non-Room Revenue */}
          {mappingStates.length > 0 && (
            <Card>
              <CardHeader className="pt-4 pb-2">
                <CardTitle className="text-sm">Non-Room Revenue</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <SectionHeading>
                  Assign a revenue category to each line
                </SectionHeading>
                {mappingStates.map((m, i) => (
                  <RevenueMappingRow
                    categories={categories}
                    key={m.sourceLabel}
                    onCategoryChange={(catId) => handleCategoryChange(i, catId)}
                    onToggleSkip={() => handleToggleSkip(i)}
                    state={m}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Payments */}
          {payments.length > 0 && (
            <Card>
              <CardHeader className="pt-4 pb-2">
                <CardTitle className="text-sm">Payments</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <SectionHeading>Payment breakdown</SectionHeading>
                {payments.map((p) => (
                  <PaymentRow
                    amount={p.amount}
                    key={p.paymentType}
                    paymentType={p.paymentType}
                  />
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 font-medium text-xs">
                  <span>Total payments</span>
                  <span className="tabular-nums">
                    {formatCurrency(paymentsTotal)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reconciliation warning */}
          <ReconciliationBanner
            paymentsTotal={paymentsTotal}
            revenueTotal={revenueTotal}
          />

          {/* Duplicate overwrite confirmation */}
          {duplicateWarning && (
            <div
              className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm"
              role="alert"
            >
              <p className="font-medium">{duplicateWarning}</p>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  checked={overwriteConfirmed}
                  className="rounded"
                  onChange={(e) => setOverwriteConfirmed(e.target.checked)}
                  type="checkbox"
                />
                Yes, overwrite the existing record for {auditDate}
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pb-6">
            <Button asChild type="button" variant="outline">
              <Link to="/dashboard">Cancel</Link>
            </Button>
            <Button
              disabled={
                !canSubmit || (duplicateWarning !== null && !overwriteConfirmed)
              }
              onClick={handleSubmit}
              type="button"
            >
              {submitting ? "Saving…" : "Save verified data"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VerifyPage — query loader wrapper ─────────────────────────────────────────

function VerifyPage() {
  const { importId } = Route.useParams();

  const verifyData = useQuery(api.uploads.queries.getVerifyData, {
    importId: importId as Id<"dataImports">,
  });

  if (verifyData === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <output
          aria-label="Loading verification data"
          className="block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        />
      </div>
    );
  }

  if (!verifyData.extractionResult) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">
          Extraction data not available. The extraction may still be in
          progress.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>
    );
  }

  const { status } = verifyData.extractionResult;

  if (status === "verified") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="font-medium">This upload has already been verified.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (status === "failed" || status === "timeout") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="font-medium text-destructive">
          {status === "timeout"
            ? "Extraction timed out — no data to verify."
            : "Extraction failed — no data to verify."}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <VerifyForm
      importId={importId as Id<"dataImports">}
      verifyData={verifyData as VerifyDataShape}
    />
  );
}
