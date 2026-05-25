import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface CategoryOption {
  _id: string;
  displayOrder: number;
  name: string;
  parentDisplayOrder: number;
  parentId: string | null;
  parentName: string | null;
}

interface CategoryGroup {
  children: CategoryOption[];
  parentId: string | null;
  parentName: string;
}

interface MappingState {
  amount: number;
  confidence: number;
  isManual: boolean;
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

interface PaymentState {
  amount: number;
  paymentType: string;
  skipped: boolean;
}

interface ProposedMapping {
  amount: number;
  confidence: number;
  proposedCategoryId: string | null;
  sourceLabel: string;
}

interface VerifyDataShape {
  categories: CategoryOption[];
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

function buildCategoryGroups(categories: CategoryOption[]): CategoryGroup[] {
  const groupMap = new Map<string, CategoryGroup>();
  for (const cat of categories) {
    const key = cat.parentId ?? "__none__";
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        parentId: cat.parentId,
        parentName: cat.parentName ?? "Other",
        children: [],
      });
    }
    groupMap.get(key)?.children.push(cat);
  }
  return [...groupMap.values()];
}

// ── ConfidencePip ──────────────────────────────────────────────────────────────

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

// ── FilePreview ────────────────────────────────────────────────────────────────

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

// ── RoomStatRow ────────────────────────────────────────────────────────────────

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

// ── CategoryCombobox ───────────────────────────────────────────────────────────

function CategoryCombobox({
  categories,
  selectedId,
  onSelect,
  inputLabel,
}: {
  categories: CategoryOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  inputLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedName = useMemo(
    () => categories.find((c) => c._id === selectedId)?.name ?? "",
    [categories, selectedId]
  );

  const groups = useMemo(() => {
    const lower = search.toLowerCase();
    const filtered = categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(lower) ||
        (cat.parentName?.toLowerCase().includes(lower) ?? false)
    );
    return buildCategoryGroups(filtered);
  }, [categories, search]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setSearch("");
      setOpen(false);
    },
    [onSelect]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative flex-1" ref={containerRef}>
      <input
        aria-autocomplete="list"
        aria-controls="category-listbox"
        aria-expanded={open}
        aria-label={inputLabel}
        className="h-7 w-full rounded border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-1 dark:bg-input/30"
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        placeholder={selectedName || "— Select or type to filter —"}
        ref={inputRef}
        role="combobox"
        type="text"
        value={open ? search : selectedName}
      />
      {open && (
        <div
          className="absolute top-8 left-0 z-50 max-h-64 w-full min-w-[220px] overflow-y-auto rounded border border-input bg-popover shadow-lg"
          id="category-listbox"
          role="listbox"
        >
          {groups.length === 0 ? (
            <div className="px-2 py-3 text-center text-muted-foreground text-xs">
              No categories found
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.parentId ?? "__none__"}>
                <div
                  aria-hidden="true"
                  className="px-2 pt-2 pb-0.5 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  {group.parentName}
                </div>
                {group.children.map((cat) => (
                  <div
                    aria-selected={selectedId === cat._id}
                    className={`cursor-pointer px-4 py-1.5 text-xs hover:bg-accent ${
                      selectedId === cat._id ? "bg-accent/50 font-medium" : ""
                    }`}
                    key={cat._id}
                    onClick={() => handleSelect(cat._id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(cat._id);
                      }
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    role="option"
                    tabIndex={0}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── RevenueMappingRow ──────────────────────────────────────────────────────────

function RevenueMappingRow({
  state,
  index,
  categories,
  onCategoryChange,
  onToggleSkip,
  onEditSourceLabel,
  onEditAmount,
}: {
  state: MappingState;
  index: number;
  categories: CategoryOption[];
  onCategoryChange: (categoryId: string | null) => void;
  onToggleSkip: () => void;
  onEditSourceLabel?: (label: string) => void;
  onEditAmount?: (val: string) => void;
}) {
  const level = getConfidenceLevel(state.confidence, state.proposedCategoryId);
  const isResolved =
    state.skipped || level === "green" || state.selectedCategoryId !== null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 py-2 text-xs ${state.skipped ? "opacity-50" : ""}`}
    >
      <ConfidencePip level={isResolved ? "green" : level} />

      {state.isManual ? (
        <input
          aria-label={`Revenue line ${index + 1} description`}
          className="h-7 w-36 shrink-0 rounded border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-1 dark:bg-input/30"
          onChange={(e) => onEditSourceLabel?.(e.target.value)}
          placeholder="Description"
          type="text"
          value={state.sourceLabel}
        />
      ) : (
        <span className="w-36 shrink-0 truncate font-medium">
          {state.sourceLabel}
        </span>
      )}

      {state.isManual ? (
        <input
          aria-label={`Revenue line ${index + 1} amount`}
          className="h-7 w-24 shrink-0 rounded border border-input bg-transparent px-2 text-right text-xs tabular-nums outline-none focus-visible:ring-1 dark:bg-input/30"
          onChange={(e) => onEditAmount?.(e.target.value)}
          placeholder="0.00"
          step="any"
          type="number"
          value={state.amount === 0 ? "" : String(state.amount)}
        />
      ) : (
        <span className="w-24 shrink-0 text-right text-muted-foreground">
          {formatCurrency(state.amount)}
        </span>
      )}

      {!state.skipped && (
        <CategoryCombobox
          categories={categories}
          inputLabel={`Revenue category for ${state.sourceLabel || `line ${index + 1}`}`}
          onSelect={onCategoryChange}
          selectedId={state.selectedCategoryId}
        />
      )}

      <Button
        className="h-6 shrink-0 px-2 text-xs"
        onClick={onToggleSkip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onToggleSkip();
          }
        }}
        type="button"
        variant="ghost"
      >
        {state.skipped ? "Undo skip" : "Skip"}
      </Button>
    </div>
  );
}

// ── PaymentRow ─────────────────────────────────────────────────────────────────

function PaymentRow({
  state,
  onEditAmount,
  onToggleSkip,
}: {
  state: PaymentState;
  onEditAmount: (val: string) => void;
  onToggleSkip: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 py-1 text-xs ${state.skipped ? "opacity-40" : ""}`}
    >
      <span className="flex-1 text-muted-foreground">{state.paymentType}</span>
      {state.skipped ? (
        <span className="text-muted-foreground text-xs italic">skipped</span>
      ) : (
        <input
          aria-label={`Amount for ${state.paymentType}`}
          className="h-7 w-28 rounded border border-input bg-transparent px-2 text-right text-xs tabular-nums outline-none focus-visible:ring-1 dark:bg-input/30"
          onChange={(e) => onEditAmount(e.target.value)}
          step="any"
          type="number"
          value={String(state.amount)}
        />
      )}
      <Button
        className="h-6 shrink-0 px-2 text-xs"
        onClick={onToggleSkip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onToggleSkip();
          }
        }}
        type="button"
        variant="ghost"
      >
        {state.skipped ? "Undo" : "Skip"}
      </Button>
    </div>
  );
}

// ── VerifyForm ─────────────────────────────────────────────────────────────────

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

  // ── state ────────────────────────────────────────────────────────────────────

  const [auditDate, setAuditDate] = useState(extractionResult.auditDate ?? "");
  const [skipRoomStats, setSkipRoomStats] = useState(false);

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
      isManual: false,
    }))
  );

  const [paymentStates, setPaymentStates] = useState<PaymentState[]>(() =>
    extractionResult.payments.map((p) => ({
      paymentType: p.paymentType,
      amount: p.amount,
      skipped: false,
    }))
  );

  const [submitting, setSubmitting] = useState(false);

  // ── derived ──────────────────────────────────────────────────────────────────

  const dateWarning = auditDate ? getDateWarning(auditDate) : null;
  const dateValid = ISO_DATE_REGEX.test(auditDate);

  const paymentsTotal = useMemo(
    () =>
      paymentStates
        .filter((p) => !p.skipped)
        .reduce((sum, p) => sum + p.amount, 0),
    [paymentStates]
  );

  const allFieldsResolved =
    skipRoomStats ||
    FIELD_ORDER.every((key) => {
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

  const allMappingsResolved = mappingStates.every((m) => {
    if (m.skipped) {
      return true;
    }
    if (m.isManual) {
      return m.sourceLabel.trim() !== "" && m.selectedCategoryId !== null;
    }
    return (
      getConfidenceLevel(m.confidence, m.proposedCategoryId) === "green" ||
      m.selectedCategoryId !== null
    );
  });

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

  const handleEditManualSourceLabel = useCallback(
    (index: number, label: string) => {
      setMappingStates((prev) =>
        prev.map((m, i) => (i === index ? { ...m, sourceLabel: label } : m))
      );
    },
    []
  );

  const handleEditManualAmount = useCallback((index: number, val: string) => {
    setMappingStates((prev) =>
      prev.map((m, i) => (i === index ? { ...m, amount: Number(val) || 0 } : m))
    );
  }, []);

  const handleAddManualLine = useCallback(() => {
    setMappingStates((prev) => [
      ...prev,
      {
        sourceLabel: "",
        amount: 0,
        confidence: 1,
        proposedCategoryId: null,
        selectedCategoryId: null,
        skipped: false,
        isManual: true,
      },
    ]);
  }, []);

  const handleEditPaymentAmount = useCallback((index: number, val: string) => {
    setPaymentStates((prev) =>
      prev.map((p, i) => (i === index ? { ...p, amount: Number(val) || 0 } : p))
    );
  }, []);

  const handleToggleSkipPayment = useCallback((index: number) => {
    setPaymentStates((prev) =>
      prev.map((p, i) => (i === index ? { ...p, skipped: !p.skipped } : p))
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

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

    const resolvedPayments = paymentStates
      .filter((p) => !p.skipped)
      .map((p) => ({ paymentType: p.paymentType, amount: p.amount }));

    try {
      await confirmVerify({
        importId,
        auditDate,
        skipRoomStats: skipRoomStats || undefined,
        resolvedFields,
        resolvedMappings,
        resolvedPayments,
      });

      toast.success("Audit data saved successfully.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      toast.error(raw);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    fieldValues,
    mappingStates,
    paymentStates,
    auditDate,
    skipRoomStats,
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Room Statistics</CardTitle>
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
                  <input
                    checked={skipRoomStats}
                    className="rounded"
                    onChange={(e) => setSkipRoomStats(e.target.checked)}
                    type="checkbox"
                  />
                  Not in this report
                </label>
              </div>
            </CardHeader>
            {!skipRoomStats && (
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
            )}
          </Card>

          {/* Non-Room Revenue */}
          <Card>
            <CardHeader className="pt-4 pb-2">
              <CardTitle className="text-sm">Non-Room Revenue</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {mappingStates.length > 0 && (
                <>
                  <SectionHeading>
                    Assign a revenue category to each line
                  </SectionHeading>
                  {mappingStates.map((m, i) => (
                    <RevenueMappingRow
                      categories={categories}
                      index={i}
                      key={m.isManual ? `manual-${i}` : m.sourceLabel}
                      onCategoryChange={(catId) =>
                        handleCategoryChange(i, catId)
                      }
                      onEditAmount={(val) => handleEditManualAmount(i, val)}
                      onEditSourceLabel={(label) =>
                        handleEditManualSourceLabel(i, label)
                      }
                      onToggleSkip={() => handleToggleSkip(i)}
                      state={m}
                    />
                  ))}
                </>
              )}
              <button
                className="mt-2 flex items-center gap-1 text-primary text-xs hover:underline"
                onClick={handleAddManualLine}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleAddManualLine();
                  }
                }}
                type="button"
              >
                + Add line
              </button>
            </CardContent>
          </Card>

          {/* Payments */}
          {paymentStates.length > 0 && (
            <Card>
              <CardHeader className="pt-4 pb-2">
                <CardTitle className="text-sm">Payments</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <SectionHeading>Payment breakdown</SectionHeading>
                {paymentStates.map((p, i) => (
                  <PaymentRow
                    key={p.paymentType}
                    onEditAmount={(val) => handleEditPaymentAmount(i, val)}
                    onToggleSkip={() => handleToggleSkipPayment(i)}
                    state={p}
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pb-6">
            <Button asChild type="button" variant="outline">
              <Link to="/dashboard">Cancel</Link>
            </Button>
            <Button disabled={!canSubmit} onClick={handleSubmit} type="button">
              {submitting ? "Saving…" : "Save verified data"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VerifyPage ─────────────────────────────────────────────────────────────────

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
