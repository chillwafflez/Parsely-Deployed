"use client";

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import type { ExtractedField } from "@/lib/types";

interface ExtractedFieldsTableProps {
  fields: ExtractedField[];
}

const useStyles = makeStyles({
  wrapper: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.overflow("hidden"),
  },
  confidenceHigh: {
    color: tokens.colorPaletteGreenForeground1,
  },
  confidenceMedium: {
    color: tokens.colorPaletteDarkOrangeForeground1,
  },
  confidenceLow: {
    color: tokens.colorPaletteRedForeground1,
  },
  empty: {
    ...shorthands.padding(tokens.spacingVerticalXL),
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
});

function confidenceClass(styles: ReturnType<typeof useStyles>, c: number) {
  if (c >= 0.85) return styles.confidenceHigh;
  if (c >= 0.6) return styles.confidenceMedium;
  return styles.confidenceLow;
}

export function ExtractedFieldsTable({ fields }: ExtractedFieldsTableProps) {
  const styles = useStyles();

  if (fields.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>
          <Text>No fields extracted.</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Table aria-label="Extracted fields" size="small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Field</TableHeaderCell>
            <TableHeaderCell>Value</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Confidence</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Text weight="semibold">{f.name}</Text>
              </TableCell>
              <TableCell>{f.value ?? <Text italic>—</Text>}</TableCell>
              <TableCell>
                <Badge appearance="outline">{f.dataType}</Badge>
              </TableCell>
              <TableCell>
                <Text className={confidenceClass(styles, f.confidence)}>
                  {(f.confidence * 100).toFixed(1)}%
                </Text>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
