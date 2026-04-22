import { cn } from "@/lib/cn";
import styles from "./toast.module.css";

interface ToastProps {
  message: string;
  tone?: "ok" | "err";
}

export function Toast({ message, tone = "ok" }: ToastProps) {
  return (
    <div role="status" aria-live="polite" className={styles.toast}>
      <span className={cn(styles.dot, tone === "err" && styles.dotErr)} />
      {message}
    </div>
  );
}
