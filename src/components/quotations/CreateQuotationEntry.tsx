"use client";

import { useState } from "react";
import { Card, PrimaryButton, SecondaryButton, selectClass } from "@/components/ui";
import { CreateQuotationForm } from "@/components/quotations/CreateQuotationForm";
import { labelize } from "@/lib/format";
import type { LeadPickerOption } from "@/server/data/quotations";
import type { ProductOption } from "@/server/data/products";

/**
 * The /quotations page has no lead in context yet — a Quotation always
 * belongs to exactly one Lead, so this picks one first, then hands off to
 * the same CreateQuotationForm used on Lead Detail.
 */
export function CreateQuotationEntry({
  leads,
  products,
  suggestedQuotationNumber,
  actingUserId,
}: {
  leads: LeadPickerOption[];
  products: ProductOption[];
  suggestedQuotationNumber: string;
  actingUserId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState("");

  function close() {
    setOpen(false);
    setLeadId("");
  }

  if (!open) {
    return <PrimaryButton onClick={() => setOpen(true)}>+ Create Quotation</PrimaryButton>;
  }

  if (!leadId) {
    return (
      <Card title="Create Quotation" description="Pick the lead this quotation is for.">
        <div className="flex flex-col gap-3">
          {leads.length === 0 ? (
            <p className="text-sm text-slate-500">No open leads to quote. Add a lead first.</p>
          ) : (
            <select defaultValue="" onChange={(e) => setLeadId(e.target.value)} className={selectClass}>
              <option value="" disabled>
                Select a lead…
              </option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.customerName} — {l.title} ({labelize(l.status)})
                </option>
              ))}
            </select>
          )}
          <SecondaryButton className="self-start" onClick={close}>
            Cancel
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  const selectedLead = leads.find((l) => l.id === leadId);

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setLeadId("")} className="self-start text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline">
        ← Change lead
      </button>
      <CreateQuotationForm
        leadId={leadId}
        products={products}
        suggestedQuotationNumber={suggestedQuotationNumber}
        actingUserId={actingUserId}
        context={
          selectedLead
            ? { leadTitle: selectedLead.title, customerName: selectedLead.customerName, ownerName: selectedLead.ownerName }
            : undefined
        }
        onDone={close}
        onCancel={close}
      />
    </div>
  );
}
