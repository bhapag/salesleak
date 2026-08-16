"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseCsv, type ParsedCsv } from "@/lib/csv";
import { autoMapColumns, matchLeadSource, parseEstimatedValue, parseCsvDate, LEAD_IMPORT_FIELDS, type LeadImportField } from "@/lib/csvMapping";
import { normalizePhone, normalizeEmail } from "@/lib/contactMatch";
import { LEAD_SOURCES } from "@/lib/constants";
import { formatSource, formatCurrency } from "@/lib/format";
import { Card, PrimaryButton, SecondaryButton, selectClass } from "@/components/ui";
import {
  getExistingContactsForImportPreview,
  importCsvLeads,
  type ExistingContact,
  type CsvImportSummary,
} from "@/server/actions/ingestion";
import type { LeadSource } from "@/generated/prisma/client";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;
const PREVIEW_ROW_LIMIT = 300;

type Step = "upload" | "map" | "preview" | "importing" | "done";

type PreviewRow = {
  index: number;
  customerName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  source: LeadSource;
  product: string | null;
  quantity: string | null;
  requirement: string | null;
  estimatedValue: number | null;
  assignToUserId: string | null;
  assignToUserName: string | null;
  receivedAt: string | null;
  errors: string[];
  duplicateReason: string | null;
};

function buildPreviewRows(
  parsed: ParsedCsv,
  mapping: Partial<Record<LeadImportField, string>>,
  defaultSource: LeadSource,
  existingContacts: ExistingContact[],
  users: { id: string; name: string }[]
): PreviewRow[] {
  const colIndex = (field: LeadImportField) => {
    const header = mapping[field];
    return header ? parsed.headers.indexOf(header) : -1;
  };
  const idx: Record<LeadImportField, number> = Object.fromEntries(
    LEAD_IMPORT_FIELDS.map((f) => [f.key, colIndex(f.key)])
  ) as Record<LeadImportField, number>;

  const usersByName = new Map(users.map((u) => [u.name.trim().toLowerCase(), u]));
  const seenPhones = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  return parsed.rows.map((row, index) => {
    const get = (field: LeadImportField) => (idx[field] >= 0 ? (row[idx[field]] ?? "").trim() : "");

    const customerName = get("customerName");
    const companyName = get("companyName") || null;
    const phone = get("phone") || null;
    const email = get("email") || null;
    const city = get("city") || null;
    const state = get("state") || null;
    const product = get("product") || null;
    const requirement = get("requirement") || null;
    const quantity = get("quantity") || null;
    const sourceText = get("source");
    const source = (matchLeadSource(sourceText) as LeadSource | null) ?? defaultSource;
    const estimatedValue = parseEstimatedValue(get("estimatedValue"));
    const receivedAt = parseCsvDate(get("receivedAt"));
    const salespersonText = get("assignedSalesperson");
    const matchedUser = salespersonText ? usersByName.get(salespersonText.trim().toLowerCase()) : undefined;

    const errors: string[] = [];
    if (!customerName) errors.push("Missing customer/company name.");

    let duplicateReason: string | null = null;
    const normPhone = normalizePhone(phone);
    const normEmail = normalizeEmail(email);

    const existingMatch = existingContacts.find(
      (c) => (normPhone && normalizePhone(c.phone) === normPhone) || (normEmail && normalizeEmail(c.email) === normEmail)
    );
    if (existingMatch?.recentActiveLeadTitle) {
      duplicateReason = `${existingMatch.customerName} already has a recent open enquiry ("${existingMatch.recentActiveLeadTitle}").`;
    } else if (normPhone && seenPhones.has(normPhone)) {
      duplicateReason = `Same phone also appears in row ${seenPhones.get(normPhone)! + 1} of this file.`;
    } else if (normEmail && seenEmails.has(normEmail)) {
      duplicateReason = `Same email also appears in row ${seenEmails.get(normEmail)! + 1} of this file.`;
    }
    if (normPhone && !seenPhones.has(normPhone)) seenPhones.set(normPhone, index);
    if (normEmail && !seenEmails.has(normEmail)) seenEmails.set(normEmail, index);

    return {
      index,
      customerName,
      companyName,
      phone,
      email,
      city,
      state,
      source,
      product,
      quantity,
      requirement,
      estimatedValue,
      assignToUserId: matchedUser?.id ?? null,
      assignToUserName: matchedUser?.name ?? null,
      receivedAt,
      errors,
      duplicateReason,
    };
  });
}

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map" },
  { key: "preview", label: "Preview & Validate" },
  { key: "done", label: "Import" },
];

export function CsvImportWizard({ users }: { users: { id: string; name: string }[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<LeadImportField, string>>>({});
  const [defaultSource, setDefaultSource] = useState<LeadSource>("CSV_IMPORT");
  const [existingContacts, setExistingContacts] = useState<ExistingContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    getExistingContactsForImportPreview().then(setExistingContacts).catch(() => setExistingContacts([]));
  }, []);

  const previewRows = useMemo(() => {
    if (!parsed) return [];
    return buildPreviewRows(parsed, mapping, defaultSource, existingContacts, users);
  }, [parsed, mapping, defaultSource, existingContacts, users]);

  const validCount = previewRows.filter((r) => r.errors.length === 0).length;
  const duplicateCount = previewRows.filter((r) => r.errors.length === 0 && r.duplicateReason).length;
  const invalidCount = previewRows.filter((r) => r.errors.length > 0).length;

  async function handleFile(file: File) {
    setFileError(null);
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setFileError("This file is larger than 2MB. Split it into smaller files and import in batches.");
      return;
    }
    try {
      const text = await file.text();
      const result = parseCsv(text);
      if (result.headers.length === 0 || result.rows.length === 0) {
        setFileError("Couldn't find any rows in this file. Make sure it's a valid CSV export with a header row.");
        return;
      }
      if (result.rows.length > MAX_ROWS) {
        setFileError(`This file has ${result.rows.length} rows — CSV import is limited to ${MAX_ROWS} rows at a time.`);
        return;
      }
      setParsed(result);
      setMapping(autoMapColumns(result.headers));
      setStep("map");
    } catch {
      setFileError("Couldn't read this file — make sure it's a valid CSV export.");
    }
  }

  function goToPreview() {
    const rows = buildPreviewRows(parsed!, mapping, defaultSource, existingContacts, users);
    const initialSelected = new Set(rows.filter((r) => r.errors.length === 0 && !r.duplicateReason).map((r) => r.index));
    setSelected(initialSelected);
    setStep("preview");
  }

  function toggleRow(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleImport() {
    setImportError(null);
    setImporting(true);
    try {
      const rowsToImport = previewRows
        .filter((r) => selected.has(r.index))
        .map((r) => ({
          customerName: r.customerName,
          companyName: r.companyName ?? undefined,
          phone: r.phone ?? undefined,
          email: r.email ?? undefined,
          city: r.city ?? undefined,
          state: r.state ?? undefined,
          source: r.source,
          product: r.product ?? undefined,
          quantity: r.quantity ?? undefined,
          requirement: r.requirement ?? undefined,
          estimatedValue: r.estimatedValue,
          assignToUserId: r.assignToUserId,
          receivedAt: r.receivedAt,
          forceCreateDespitePossibleDuplicate: !!r.duplicateReason,
        }));

      const result = await importCsvLeads(fileName ?? "import.csv", defaultSource, rowsToImport);
      setSummary(result);
      setStep("done");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("upload");
    setFileName(null);
    setFileError(null);
    setParsed(null);
    setMapping({});
    setSelected(new Set());
    setSummary(null);
    setImportError(null);
  }

  const displayedRows = (showInvalidOnly ? previewRows.filter((r) => r.errors.length > 0) : previewRows).slice(0, PREVIEW_ROW_LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <Stepper current={step} />

      {step === "upload" && (
        <Card title="Upload CSV" description="Export your enquiries as a CSV file and upload it here. Any column layout works — you'll map fields next.">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center hover:border-slate-400 hover:bg-slate-100">
            <UploadIcon className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Click to choose a CSV file</span>
            <span className="text-xs text-slate-400">Up to 2MB, {MAX_ROWS} rows</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
          {fileError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{fileError}</p>
          )}
        </Card>
      )}

      {step === "map" && parsed && (
        <Card
          title="Map Columns"
          description={`${fileName} — ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"} detected. Match each SalesLeak field to a column from your file.`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LEAD_IMPORT_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </span>
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value || undefined }))}
                  className={selectClass}
                >
                  <option value="">— Not mapped —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Default Source (used when a row&apos;s source isn&apos;t recognized)</span>
              <select value={defaultSource} onChange={(e) => setDefaultSource(e.target.value as LeadSource)} className={selectClass}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {formatSource(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
            <PrimaryButton onClick={goToPreview} disabled={!mapping.customerName}>
              Continue to Preview
            </PrimaryButton>
            <SecondaryButton onClick={reset}>Start Over</SecondaryButton>
          </div>
          {!mapping.customerName && (
            <p className="mt-2 text-xs text-amber-700">Map a column to Customer / Contact Name to continue.</p>
          )}
        </Card>
      )}

      {step === "preview" && parsed && (
        <Card title="Preview & Validate" description="Review what will be imported. Invalid rows are excluded automatically; possible duplicates are unchecked by default.">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
            <SummaryPill label="Valid" count={validCount} tone="emerald" />
            <SummaryPill label="Possible Duplicates" count={duplicateCount} tone="amber" />
            <SummaryPill label="Invalid" count={invalidCount} tone="red" />
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showInvalidOnly} onChange={(e) => setShowInvalidOnly(e.target.checked)} className="h-3.5 w-3.5" />
              Show invalid rows only
            </label>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Phone / Email</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Salesperson</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRows.map((row) => {
                  const isInvalid = row.errors.length > 0;
                  return (
                    <tr key={row.index} className={isInvalid ? "bg-red-50/40" : row.duplicateReason ? "bg-amber-50/40" : ""}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          disabled={isInvalid}
                          checked={selected.has(row.index)}
                          onChange={() => toggleRow(row.index)}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-slate-800">
                        {row.customerName || <span className="italic text-slate-400">—</span>}
                        {row.companyName && <p className="text-xs text-slate-400">{row.companyName}</p>}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-600">
                        {row.phone && <p>{row.phone}</p>}
                        {row.email && <p className="text-xs text-slate-400">{row.email}</p>}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-600">{row.product ?? "—"}</td>
                      <td className="px-3 py-2 align-top text-slate-600">{formatCurrency(row.estimatedValue)}</td>
                      <td className="px-3 py-2 align-top text-slate-600">{formatSource(row.source)}</td>
                      <td className="px-3 py-2 align-top text-slate-600">{row.assignToUserName ?? "Unassigned"}</td>
                      <td className="px-3 py-2 align-top">
                        {isInvalid ? (
                          <span className="text-xs font-medium text-red-700">{row.errors.join("; ")}</span>
                        ) : row.duplicateReason ? (
                          <span className="text-xs font-medium text-amber-700">Possible Duplicate — {row.duplicateReason}</span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">Valid</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {previewRows.length > PREVIEW_ROW_LIMIT && !showInvalidOnly && (
            <p className="mt-2 text-xs text-slate-400">
              Showing first {PREVIEW_ROW_LIMIT} of {previewRows.length} rows — all selected rows will still be imported.
            </p>
          )}

          {importError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{importError}</p>}

          <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
            <PrimaryButton onClick={handleImport} disabled={selected.size === 0 || importing}>
              {importing ? "Importing…" : `Import ${selected.size} Lead${selected.size === 1 ? "" : "s"}`}
            </PrimaryButton>
            <SecondaryButton onClick={() => setStep("map")} disabled={importing}>
              Back to Mapping
            </SecondaryButton>
            <SecondaryButton onClick={reset} disabled={importing}>
              Start Over
            </SecondaryButton>
          </div>
        </Card>
      )}

      {step === "done" && summary && (
        <Card title="Import Complete">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 px-3 py-4">
              <p className="text-2xl font-semibold text-emerald-700">{summary.created}</p>
              <p className="text-xs text-emerald-700">Leads created</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-4">
              <p className="text-2xl font-semibold text-amber-700">{summary.duplicates}</p>
              <p className="text-xs text-amber-700">Duplicates skipped</p>
            </div>
            <div className="rounded-lg bg-red-50 px-3 py-4">
              <p className="text-2xl font-semibold text-red-700">{summary.invalid}</p>
              <p className="text-xs text-red-700">Invalid rows</p>
            </div>
          </div>
          <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
            <Link href="/leads">
              <PrimaryButton>Go to Leads</PrimaryButton>
            </Link>
            <SecondaryButton onClick={reset}>Import Another File</SecondaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current || (current === "importing" && s.key === "done"));
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                i < currentIndex
                  ? "bg-emerald-600 text-white"
                  : i === currentIndex
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < currentIndex ? "✓" : i + 1}
            </span>
            <span className={`whitespace-nowrap text-xs font-medium ${i === currentIndex ? "text-slate-900" : "text-slate-400"}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && <span className="h-px w-6 shrink-0 bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}

function SummaryPill({ label, count, tone }: { label: string; count: number; tone: "emerald" | "amber" | "red" }) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}>
      {count} {label}
    </span>
  );
}

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 13V3M10 3L6.5 6.5M10 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13.5v2a1.5 1.5 0 001.5 1.5h11a1.5 1.5 0 001.5-1.5v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
