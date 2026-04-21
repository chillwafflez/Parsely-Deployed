import type { ExtractedField } from "./types";

/** Groups shown in the Inspector, in display order. */
export const FIELD_GROUPS = ["Document", "Parties", "Totals", "Line Items", "Custom"] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];

/**
 * Maps an Azure DI prebuilt-invoice field name to a display group using
 * substring heuristics. Covers the common field taxonomy:
 *
 *   Parties  → Vendor*, Customer*, *Address*, *Recipient*, BillTo*, ShipTo*, Remit*
 *   Totals   → *Total*, *Tax*, SubTotal, AmountDue, PreviousUnpaidBalance, Discount
 *   Line Items → exactly "Items"
 *   Document → everything else (InvoiceId, InvoiceDate, DueDate, PurchaseOrder,
 *              PaymentTerm, Service*Date, etc.)
 *
 * User-added custom fields (coming in Day 5) will bypass this and be tagged
 * "Custom" explicitly.
 */
export function inferFieldGroup(name: string): FieldGroup {
  const n = name.toLowerCase();

  if (n === "items") return "Line Items";

  // Address/recipient hits "Parties" before we look at other keywords so
  // ServiceAddress/BillingAddress/ShippingAddress all land together.
  if (n.includes("address") || n.includes("recipient")) return "Parties";

  if (
    n.startsWith("vendor") ||
    n.startsWith("customer") ||
    n.startsWith("billto") ||
    n.startsWith("shipto") ||
    n.startsWith("remit")
  ) {
    return "Parties";
  }

  if (
    n.includes("total") ||
    n.includes("tax") ||
    n === "subtotal" ||
    n === "amountdue" ||
    n === "previousunpaidbalance" ||
    n === "discount"
  ) {
    return "Totals";
  }

  return "Document";
}

/** Groups fields into buckets keyed by group name, preserving order within each. */
export function groupFields(
  fields: ExtractedField[]
): Map<FieldGroup, ExtractedField[]> {
  const grouped = new Map<FieldGroup, ExtractedField[]>();
  for (const group of FIELD_GROUPS) {
    grouped.set(group, []);
  }

  for (const field of fields) {
    const group = inferFieldGroup(field.name);
    grouped.get(group)!.push(field);
  }

  // Drop empty groups so the Inspector doesn't render headers with no rows
  for (const [group, list] of grouped) {
    if (list.length === 0) grouped.delete(group);
  }

  return grouped;
}
