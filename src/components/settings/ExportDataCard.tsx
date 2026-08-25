"use client";

import { useState, useTransition } from "react";
import { exportCompanyDataCsv, type ExportEntity } from "@/server/actions/export";
import { Card, SecondaryButton, ErrorText } from "@/components/ui";

const ENTITIES: { id: ExportEntity; label: string }[] = [
  { id: "customers", label: "Customers" },
  { id: "leads", label: "Leads" },
  { id: "quotations", label: "Quotations" },
];

export function ExportDataCard() {
  const [pending, startTransition] = useTransition();
  const [pendingEntity, setPendingEntity] = useState<ExportEntity | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport(entity: ExportEntity) {
    setError(null);
    setPendingEntity(entity);
    startTransition(async () => {
      try {
        const { filename, csv } = await exportCompanyDataCsv(entity);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not export this data.");
      } finally {
        setPendingEntity(null);
      }
    });
  }

  return (
    <Card title="Export Data" description="Download your company's customers, leads, and quotations as CSV — for your own records or backup.">
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map((e) => (
          <SecondaryButton key={e.id} onClick={() => handleExport(e.id)} loading={pending && pendingEntity === e.id} disabled={pending}>
            {pending && pendingEntity === e.id ? "Preparing…" : `Export ${e.label} (CSV)`}
          </SecondaryButton>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
