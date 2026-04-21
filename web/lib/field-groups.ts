import type { ExtractedField } from "./types";

/** Groups shown in the Inspector, in display order. */
export const FIELD_GROUPS = ["Document", "Parties", "Totals", "Line Items", "Custom"] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];

/**
 * Maps a field to a display group. User-added fields always land in "Custom".
 * For AI-extracted fields we use substring heuristics against Azure DI's
 * prebuilt-invoice vocabulary:
 *
 *   Parties  → Vendor*, Customer*, *Address*, *Recipient*, BillTo*, ShipTo*, Remit*
 *   Totals   → *Total*, *Tax*, SubTotal, AmountDue, PreviousUnpaidBalance, Discount
 *   Line Items → exactly "Items"
 *   Document → everything else (InvoiceId, InvoiceDate, DueDate, PurchaseOrder,
 *              PaymentTerm, Service*Date, etc.)
 */
export function inferFieldGroup(name: string, isUserAdded = false): FieldGroup {
  if (isUserAdded) return "Custom";

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
    const group = inferFieldGroup(field.name, field.isUserAdded);
    grouped.get(group)!.push(field);
  }

  // Drop empty groups so the Inspector doesn't render headers with no rows
  for (const [group, list] of grouped) {
    if (list.length === 0) grouped.delete(group);
  }

  return grouped;
}
