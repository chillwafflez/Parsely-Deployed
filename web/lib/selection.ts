/**
 * What is currently highlighted on the document. Discriminated so a single
 * setter can swap between "a field" and "a table cell" without leaving stale
 * state from the previous mode (the union forbids both being set at once).
 *
 * Phase C only constructs the `field` variant; the `tableCell` variant lands
 * in Phase D when the bottom drawer wires cell clicks back into selection.
 */
export type Selection =
  | { kind: "field"; fieldId: string }
  | {
      kind: "tableCell";
      tableId: string;
      rowIndex: number;
      columnIndex: number;
    };

export function isFieldSelection(
  s: Selection | null
): s is Extract<Selection, { kind: "field" }> {
  return s?.kind === "field";
}

export function isTableCellSelection(
  s: Selection | null
): s is Extract<Selection, { kind: "tableCell" }> {
  return s?.kind === "tableCell";
}

/** Convenience for components that only care about the field-id case. */
export function selectedFieldId(s: Selection | null): string | null {
  return isFieldSelection(s) ? s.fieldId : null;
}
