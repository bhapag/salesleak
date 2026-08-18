"use client";

import { useMemo, useState, useTransition } from "react";
import { createQuotation, type CreateQuotationLineInput } from "@/server/actions/quotations";
import { Card, Field, PrimaryButton, SecondaryButton, ErrorText, inputClass, selectClass } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import type { ProductOption } from "@/server/data/products";

type LineItem = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

let lineKeySeq = 0;
function emptyLine(): LineItem {
  lineKeySeq += 1;
  return { key: `line-${lineKeySeq}`, productId: "", description: "", quantity: "1", unitPrice: "" };
}

/**
 * Reusable line-item quotation form. leadId is fixed by the caller — a
 * Quotation always belongs to exactly one Lead (schema requires it), so
 * callers without a lead in context yet (the /quotations page) pick one
 * first and only then render this.
 */
export function CreateQuotationForm({
  leadId,
  products,
  suggestedQuotationNumber,
  actingUserId,
  context,
  onDone,
  onCancel,
}: {
  leadId: string;
  products: ProductOption[];
  suggestedQuotationNumber: string;
  actingUserId: string | null;
  context?: { leadTitle: string; customerName: string; ownerName: string | null };
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [quotationNumber, setQuotationNumber] = useState(suggestedQuotationNumber);
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [sentAt, setSentAt] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successNumber, setSuccessNumber] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateItem(key: string, patch: Partial<LineItem>) {
    setSuccessNumber(null);
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function selectProduct(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    setSuccessNumber(null);
    setItems((rows) =>
      rows.map((r) =>
        r.key === key
          ? {
              ...r,
              productId,
              description: r.description || product?.name || "",
              unitPrice: r.unitPrice || (product?.defaultPrice != null ? String(product.defaultPrice) : ""),
            }
          : r
      )
    );
  }

  function addLine() {
    setItems((rows) => [...rows, emptyLine()]);
  }

  function removeLine(key: string) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);
      if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
      return sum + qty * price;
    }, 0);
  }, [items]);

  function validate(): string | null {
    if (!quotationNumber.trim()) return "Quotation number is required.";
    const usable = items.filter((i) => i.description.trim() || i.productId);
    if (usable.length === 0) return "Add at least one line item.";
    for (const item of usable) {
      if (!item.description.trim()) return "Every line item needs a description.";
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return `Quantity for "${item.description}" must be greater than zero.`;
      const price = Number(item.unitPrice);
      if (!Number.isFinite(price) || price < 0) return `Unit price for "${item.description}" can't be negative.`;
    }
    if (followUpDate && !nextAction.trim()) return "Add a next action to go with the follow-up deadline.";
    if (nextAction.trim() && !followUpDate) return "Add a follow-up deadline to go with the next action.";
    return null;
  }

  function submit() {
    const clientError = validate();
    if (clientError) {
      setError(clientError);
      setSuccessNumber(null);
      return;
    }
    setError(null);

    const lineInputs: CreateQuotationLineInput[] = items
      .filter((i) => i.description.trim() || i.productId)
      .map((i) => ({
        productId: i.productId || null,
        description: i.description.trim(),
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice) || 0,
      }));
    const trimmedNumber = quotationNumber.trim();

    startTransition(async () => {
      const result = await createQuotation(
        {
          leadId,
          quotationNumber: trimmedNumber,
          items: lineInputs,
          sentAt: sentAt || null,
          validUntil: validUntil || null,
          nextAction: nextAction.trim() || null,
          followUpDate: followUpDate || null,
          notes: notes.trim() || null,
        },
        actingUserId
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccessNumber(trimmedNumber);
      setItems([emptyLine()]);
      setNotes("");
      setNextAction("");
      setFollowUpDate("");
      setValidUntil("");
      setSentAt("");
      onDone?.();
    });
  }

  return (
    <Card title="Create Quotation" description="Add line items — totals are calculated automatically.">
      <div className="flex flex-col gap-4">
        {context && (
          <p className="text-xs text-slate-500">
            For <span className="font-medium text-slate-700">{context.customerName}</span> · {context.leadTitle} · Salesperson:{" "}
            {context.ownerName ?? "Unassigned"}
          </p>
        )}
        {successNumber && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-sm font-medium text-emerald-800">Quotation {successNumber} created.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Quotation number" required>
            <input value={quotationNumber} onChange={(e) => setQuotationNumber(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Sent date (leave blank to save as draft)">
            <input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-slate-500">Line items</p>
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const qty = Number(item.quantity);
              const price = Number(item.unitPrice);
              const lineTotal = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;
              return (
                <div
                  key={item.key}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-2.5 sm:grid-cols-[1.2fr_1.6fr_0.6fr_0.8fr_0.8fr_auto] sm:items-end"
                >
                  <Field label="Product">
                    <select value={item.productId} onChange={(e) => selectProduct(item.key, e.target.value)} className={selectClass}>
                      <option value="">Custom item</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description">
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                      placeholder="e.g. Gate Valve 4 inch"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Qty">
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                      className={`${inputClass} text-right tabular-nums`}
                    />
                  </Field>
                  <Field label="Unit price (₹)">
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
                      className={`${inputClass} text-right tabular-nums`}
                    />
                  </Field>
                  <Field label="Line total">
                    <p className="px-1 py-2 text-right text-sm tabular-nums font-medium text-slate-800">{formatCurrency(lineTotal)}</p>
                  </Field>
                  <button
                    type="button"
                    onClick={() => removeLine(item.key)}
                    disabled={items.length === 1}
                    className="justify-self-start text-xs font-medium text-slate-400 transition-colors duration-(--dur-micro) hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-center"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
          <SecondaryButton onClick={addLine} className="self-start !py-1.5 !text-xs">
            + Add line item
          </SecondaryButton>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-lg font-semibold tabular-nums text-brand-navy">{formatCurrency(total)}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Field label="Next action">
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Call to confirm approval"
              className={inputClass}
            />
          </Field>
          <Field label="Follow-up deadline">
            <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Valid until (optional)">
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </Field>

        <ErrorText>{error}</ErrorText>

        <div className="flex gap-2">
          <PrimaryButton onClick={submit} disabled={pending}>
            {pending ? "Creating…" : "Create Quotation"}
          </PrimaryButton>
          {onCancel && (
            <SecondaryButton onClick={onCancel} disabled={pending}>
              Cancel
            </SecondaryButton>
          )}
        </div>
      </div>
    </Card>
  );
}
