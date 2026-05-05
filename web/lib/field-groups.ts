import type { ExtractedField } from "./types";

/**
 * Per-model grouping definitions for the Inspector. Groups are dynamic
 * strings (not a const union) so each prebuilt model can name its buckets
 * however reads best for that document type.
 *
 * Adding a model means appending an entry to {@link GROUPINGS}; the rest of
 * the Inspector resolves everything by `modelId`. Field name comparisons are
 * case-insensitive — Azure DI is consistent, but it's cheap insurance.
 */

interface GroupRule {
  group: string;
  /** Matches if `fieldName` starts with one of these. Useful for flattened
   *  Map fields like W-2's `Employer.Name` / `Employer.Address`. */
  prefixes?: string[];
  /** Matches if `fieldName` equals one of these. */
  fields?: string[];
}

interface ModelGrouping {
  /** Evaluated in order — first match wins. */
  rules: GroupRule[];
  /** Bucket for fields that match no rule and aren't user-added. */
  fallback: string;
  /** Display order for non-empty groups. Custom is appended automatically
   *  when user-added fields are present. */
  order: string[];
}

/** User-authored non-aggregation fields. */
export const USER_ADDED_GROUP = "Custom";
/** User-authored fields with an `aggregationConfig` (Sum / Avg / Count / Min / Max).
 *  Surfaces above plain Custom so the demo-grade rollups read prominently. */
export const USER_ADDED_AGG_GROUP = "Aggregations";

const USER_GROUPS_ORDER = [USER_ADDED_AGG_GROUP, USER_ADDED_GROUP];

const INVOICE_GROUPING: ModelGrouping = {
  rules: [
    { group: "Line Items", fields: ["Items"] },
    {
      group: "Parties",
      prefixes: ["Vendor", "Customer", "BillTo", "ShipTo", "Remit"],
      fields: [
        "BillingAddress",
        "BillingAddressRecipient",
        "ShippingAddress",
        "ShippingAddressRecipient",
        "RemittanceAddress",
        "RemittanceAddressRecipient",
        "ServiceAddress",
        "ServiceAddressRecipient",
      ],
    },
    {
      group: "Totals",
      fields: [
        "SubTotal",
        "TotalTax",
        "InvoiceTotal",
        "AmountDue",
        "PreviousUnpaidBalance",
        "TotalDiscount",
      ],
    },
  ],
  fallback: "Document",
  order: ["Document", "Parties", "Totals", "Line Items", ...USER_GROUPS_ORDER],
};

const RECEIPT_GROUPING: ModelGrouping = {
  rules: [
    { group: "Line Items", fields: ["Items"] },
    { group: "Merchant", prefixes: ["Merchant"] },
    {
      group: "Totals",
      fields: ["Subtotal", "TotalTax", "Tip", "Total"],
    },
  ],
  fallback: "Document",
  order: ["Document", "Merchant", "Totals", "Line Items", ...USER_GROUPS_ORDER],
};

const W2_GROUPING: ModelGrouping = {
  rules: [
    { group: "Employee", prefixes: ["Employee."] },
    { group: "Employer", prefixes: ["Employer."] },
    {
      group: "Wages & Withholdings",
      prefixes: [
        "Wages",
        "Federal",
        "SocialSecurity",
        "Medicare",
        "Allocated",
        "Dependent",
        "NonQualified",
        "Verification",
      ],
    },
  ],
  fallback: "Document",
  order: [
    "Document",
    "Employee",
    "Employer",
    "Wages & Withholdings",
    ...USER_GROUPS_ORDER,
  ],
};

const PAYSTUB_GROUPING: ModelGrouping = {
  rules: [
    { group: "Employee", prefixes: ["Employee"] },
    { group: "Employer", prefixes: ["Employer"] },
    {
      group: "Earnings",
      prefixes: ["Earnings", "Gross", "Net", "CurrentPeriod", "YearToDate"],
      fields: ["Hours", "RegularHours", "OvertimeHours"],
    },
    {
      group: "Deductions",
      prefixes: ["Deduction", "Tax", "Withhold"],
    },
  ],
  fallback: "Document",
  order: [
    "Document",
    "Employer",
    "Employee",
    "Earnings",
    "Deductions",
    ...USER_GROUPS_ORDER,
  ],
};

const BANK_STATEMENT_GROUPING: ModelGrouping = {
  rules: [
    { group: "Transactions", prefixes: ["Transaction"] },
    {
      group: "Account",
      prefixes: ["Account"],
    },
    { group: "Bank", prefixes: ["Bank"] },
    {
      group: "Balances",
      prefixes: ["Beginning", "Ending"],
      fields: [
        "TotalDeposits",
        "TotalWithdrawals",
        "TotalServiceFees",
      ],
    },
  ],
  fallback: "Statement",
  order: [
    "Statement",
    "Account",
    "Bank",
    "Balances",
    "Transactions",
    ...USER_GROUPS_ORDER,
  ],
};

const GROUPINGS: Record<string, ModelGrouping> = {
  "prebuilt-invoice": INVOICE_GROUPING,
  "prebuilt-receipt": RECEIPT_GROUPING,
  "prebuilt-tax.us.w2": W2_GROUPING,
  "prebuilt-paystub": PAYSTUB_GROUPING,
  "prebuilt-bankStatement.us": BANK_STATEMENT_GROUPING,
};

/**
 * Used when {@link GROUPINGS} has no entry for `modelId` (unknown prebuilt,
 * future model added before its grouping was wired). Renders everything in a
 * single "Fields" section so the UI stays usable.
 */
const GENERIC_GROUPING: ModelGrouping = {
  rules: [],
  fallback: "Fields",
  order: ["Fields", ...USER_GROUPS_ORDER],
};

function getGrouping(modelId: string): ModelGrouping {
  return GROUPINGS[modelId] ?? GENERIC_GROUPING;
}

/** Subset of {@link ExtractedField} the grouper actually inspects — keeps the
 *  signature decoupled from the full DTO shape so callers can pass partials. */
type GroupableField = Pick<
  ExtractedField,
  "name" | "isUserAdded" | "aggregationConfig"
>;

function inferFieldGroup(modelId: string, field: GroupableField): string {
  if (field.isUserAdded) {
    return field.aggregationConfig !== null
      ? USER_ADDED_AGG_GROUP
      : USER_ADDED_GROUP;
  }

  const grouping = getGrouping(modelId);
  const lower = field.name.toLowerCase();

  for (const rule of grouping.rules) {
    if (rule.fields?.some((f) => f.toLowerCase() === lower)) return rule.group;
    if (rule.prefixes?.some((p) => lower.startsWith(p.toLowerCase()))) {
      return rule.group;
    }
  }

  return grouping.fallback;
}

/**
 * Buckets fields by inferred group, returning a Map in the model's display
 * order. Empty buckets are dropped so the Inspector doesn't render headings
 * with no rows. Buckets that aren't in the model's `order` (unknown groups
 * produced by an unexpected field) are appended at the end.
 */
export function groupFields(
  modelId: string,
  fields: ExtractedField[]
): Map<string, ExtractedField[]> {
  const grouping = getGrouping(modelId);
  const buckets = new Map<string, ExtractedField[]>();

  for (const groupName of grouping.order) {
    buckets.set(groupName, []);
  }

  for (const field of fields) {
    const group = inferFieldGroup(modelId, field);
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group)!.push(field);
  }

  for (const [group, list] of buckets) {
    if (list.length === 0) buckets.delete(group);
  }

  return buckets;
}
