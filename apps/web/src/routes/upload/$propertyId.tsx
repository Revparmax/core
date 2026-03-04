import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/upload/$propertyId")({
  component: UploadPage,
});

// ── constants ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTENSIONS = ".pdf,.csv,.xls,.xlsx";
const MAX_BYTES = 50_000_000;

// ── types ──────────────────────────────────────────────────────────────────────

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: string }
  | { phase: "processing"; importId: Id<"dataImports"> }
  | { phase: "error"; message: string };

// ── sub-components ─────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        toast.error(
          "Unsupported file type. Please upload a PDF, CSV, XLS, or XLSX file."
        );
        return;
      }
      if (file.size >= MAX_BYTES) {
        toast.error("File exceeds the 50 MB limit.");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  return (
    <button
      aria-label="Drop zone for uploading a PMS report file"
      className={[
        "w-full cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-primary/60",
        disabled ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragLeave={() => setDragging(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files.item(0);
        if (file) {
          handleFile(file);
        }
      }}
      type="button"
    >
      <input
        accept={ALLOWED_EXTENSIONS}
        aria-label="File input for PMS report"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.item(0);
          if (file) {
            handleFile(file);
          }
          e.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <p className="text-muted-foreground text-sm">
        Drag and drop a file here, or{" "}
        <span className="font-medium text-primary">browse</span>
      </p>
      <p className="mt-1 text-muted-foreground text-xs">
        PDF, XLSX, XLS, or CSV · max 50 MB
      </p>
    </button>
  );
}

function ProcessingStatus({
  importId,
  onReset,
}: {
  importId: Id<"dataImports">;
  onReset: () => void;
}) {
  const data = useQuery(api.uploads.queries.getImport, { importId });

  if (!data) {
    return (
      <div className="space-y-3 text-center">
        <Spinner />
        <p className="text-muted-foreground text-sm">Loading status…</p>
      </div>
    );
  }

  const { dataImport, extractionResult } = data;
  const { scanStatus, extractionStatus } = dataImport;

  // Error states
  if (scanStatus === "infected") {
    return (
      <ErrorState
        description="This file was flagged during security scanning. Please try a different file."
        onReset={onReset}
        title="Upload rejected"
      />
    );
  }

  if (scanStatus === "scan_failed") {
    return (
      <ErrorState
        description="We couldn't scan this file. Please try again."
        onReset={onReset}
        title="Scan failed"
      />
    );
  }

  if (extractionStatus === "failed") {
    return (
      <ErrorState
        description={
          extractionResult?.status === "failed"
            ? "This appears to be a scanned image PDF — text extraction is not supported yet. Please enter data manually or upload a text-based file."
            : "We couldn't extract data from this file. Please try again."
        }
        onReset={onReset}
        title="Extraction failed"
      />
    );
  }

  if (extractionStatus === "timeout") {
    return (
      <ErrorState
        description="The AI took too long to process this file. Please try again."
        onReset={onReset}
        title="Extraction timed out"
      />
    );
  }

  if (extractionStatus === "completed" && extractionResult) {
    return (
      <div className="space-y-4 text-center">
        <div
          aria-hidden="true"
          className="text-4xl text-green-600 dark:text-green-400"
        >
          ✓
        </div>
        <div>
          <p className="font-medium">Extraction complete</p>
          {dataImport.extractedAt && (
            <p className="mt-1 text-muted-foreground text-sm">
              {extractionResult.auditDate
                ? `Audit date: ${extractionResult.auditDate}`
                : "Audit date not detected"}
            </p>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Review and verify the extracted data before it's saved.
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link params={{ importId }} to="/upload/verify/$importId">
              Review extracted data
            </Link>
          </Button>
          <Button onClick={onReset} variant="outline">
            Upload another file
          </Button>
        </div>
      </div>
    );
  }

  // In-progress states
  let statusText = "Processing…";
  if (scanStatus === "pending") {
    statusText = "Scanning for security…";
  } else if (extractionStatus === "in_progress") {
    statusText = "Extracting data with AI…";
  }

  return (
    <div className="space-y-3 text-center">
      <Spinner />
      <p className="text-muted-foreground text-sm">{statusText}</p>
    </div>
  );
}

function ErrorState({
  title,
  description,
  onReset,
}: {
  title: string;
  description: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <div aria-hidden="true" className="text-4xl text-destructive">
        ✕
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
      <Button onClick={onReset} variant="outline">
        Try again
      </Button>
    </div>
  );
}

function Spinner() {
  return (
    <output
      aria-label="Loading"
      className="mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
    />
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

function UploadPage() {
  const { propertyId } = Route.useParams();
  const navigate = useNavigate();

  const property = useQuery(api.properties.queries.getProperty, {
    propertyId: propertyId as Id<"properties">,
  });

  const generateUploadUrl = useMutation(
    api.uploads.mutations.generateUploadUrl
  );
  const recordUpload = useMutation(api.uploads.mutations.recordUpload);

  const [state, setState] = useState<UploadState>({ phase: "idle" });

  // Redirect if the property doesn't exist or isn't accessible.
  useEffect(() => {
    if (property === null) {
      navigate({ to: "/dashboard" });
    }
  }, [property, navigate]);

  const handleFile = useCallback(
    async (file: File) => {
      setState({ phase: "uploading", progress: "Preparing upload…" });

      try {
        // Step 1: Get a signed upload URL from Convex.
        setState({ phase: "uploading", progress: "Requesting upload URL…" });
        const { uploadUrl } = await generateUploadUrl({
          propertyId: propertyId as Id<"properties">,
          fileSizeBytes: file.size,
          mimeType: file.type,
        });

        // Step 2: PUT the file directly to Convex storage.
        setState({ phase: "uploading", progress: "Uploading file…" });
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        const { storageId } = (await uploadResponse.json()) as {
          storageId: Id<"_storage">;
        };

        // Step 3: Record the upload in Convex and kick off scanning + extraction.
        setState({ phase: "uploading", progress: "Registering upload…" });
        const importId = await recordUpload({
          propertyId: propertyId as Id<"properties">,
          storageId,
          originalFilename: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type,
        });

        setState({ phase: "processing", importId });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        toast.error(message);
        setState({ phase: "error", message });
      }
    },
    [propertyId, generateUploadUrl, recordUpload]
  );

  const reset = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  if (property === null || property === undefined) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          to="/dashboard"
        >
          ← Dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload PMS report</CardTitle>
          {property && <CardDescription>{property.name}</CardDescription>}
        </CardHeader>
        <CardContent>
          {state.phase === "idle" && (
            <DropZone disabled={false} onFile={handleFile} />
          )}

          {state.phase === "uploading" && (
            <div className="space-y-3 py-8 text-center">
              <Spinner />
              <p className="text-muted-foreground text-sm">{state.progress}</p>
            </div>
          )}

          {state.phase === "processing" && (
            <div className="py-8">
              <ProcessingStatus importId={state.importId} onReset={reset} />
            </div>
          )}

          {state.phase === "error" && (
            <div className="py-8">
              <ErrorState
                description={state.message}
                onReset={reset}
                title="Upload failed"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
