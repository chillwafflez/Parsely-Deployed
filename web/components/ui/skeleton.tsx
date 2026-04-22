import * as React from "react";
import { cn } from "@/lib/cn";
import styles from "./skeleton.module.css";

type CssLen = string | number;

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: CssLen;
  height?: CssLen;
  /** Corner radius override. Defaults to 4px via the stylesheet. */
  radius?: CssLen;
}

/**
 * Decorative placeholder that shimmers while real content is loading.
 * Always sets `aria-hidden` — wrap consumer containers in `aria-busy="true"`
 * plus an `aria-label` so assistive tech announces the loading state once
 * rather than one ping per skeleton box.
 */
export function Skeleton({
  width,
  height,
  radius,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(radius !== undefined && { borderRadius: radius }),
  };

  return (
    <div
      aria-hidden="true"
      className={cn(styles.skeleton, className)}
      style={mergedStyle}
      {...rest}
    />
  );
}
