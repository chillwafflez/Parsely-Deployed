import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  active?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "default", active, className, children, type = "button", ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center gap-1.5",
          "h-7 px-2.5 rounded-md border",
          "text-[12.5px] font-medium",
          "cursor-pointer",
          "transition-[background-color,border-color,color] duration-100",
          "disabled:opacity-[0.55] disabled:cursor-not-allowed",
          variant === "default" && [
            "bg-surface text-ink-2 border-line",
            "hover:bg-surface-2 hover:border-line-strong hover:text-ink",
          ],
          variant === "primary" && [
            "bg-accent text-white",
            "border-[color-mix(in_oklab,var(--color-accent)_70%,black)]",
            "shadow-[0_1px_0_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.15)]",
            "hover:enabled:bg-[color-mix(in_oklab,var(--color-accent)_88%,black)]",
            "hover:enabled:border-[color-mix(in_oklab,var(--color-accent)_60%,black)]",
          ],
          variant === "ghost" && [
            "bg-transparent text-ink-2 border-transparent",
            "hover:bg-surface-2 hover:border-line hover:text-ink",
          ],
          variant === "danger" && [
            "bg-surface text-err border-line",
            "hover:bg-err-weak hover:text-err",
            "hover:border-[color-mix(in_oklab,var(--color-err)_30%,white)]",
          ],
          active && "bg-accent-weak text-accent-ink border-accent-border",
          className
        )}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 font-mono text-[10.5px] py-px px-1 rounded-[3px] bg-[rgba(15,23,42,0.06)] text-ink-3">
      {children}
    </span>
  );
}
