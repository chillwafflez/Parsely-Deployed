import { cn } from "@/lib/cn";

interface ToastProps {
  message: string;
  tone?: "ok" | "err";
}

export function Toast({ message, tone = "ok" }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-5 left-1/2 -translate-x-1/2 z-[200]",
        "flex items-center gap-2.5",
        "py-2.5 px-4 rounded-lg",
        "bg-ink text-white text-[12.5px]",
        "shadow-lg",
        "animate-toast-in"
      )}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          tone === "err" ? "bg-err" : "bg-ok"
        )}
      />
      {message}
    </div>
  );
}
