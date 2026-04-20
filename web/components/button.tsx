import * as React from "react";
import { cn } from "@/lib/cn";
import styles from "./button.module.css";

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  active?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", active, className, children, type = "button", ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          styles.btn,
          variant === "primary" && styles.primary,
          variant === "ghost" && styles.ghost,
          variant === "danger" && styles.danger,
          active && styles.active,
          className
        )}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export function Kbd({ children }: { children: React.ReactNode }) {
  return <span className={styles.kbd}>{children}</span>;
}
