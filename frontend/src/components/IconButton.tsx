import { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "../styles/IconButton.module.css";

type Size = "sm" | "md";
type Variant = "ghost" | "outline";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: Size;
  variant?: Variant;
  ariaLabel: string;
}

export function IconButton({
  children,
  size = "md",
  variant = "ghost",
  ariaLabel,
  disabled = false,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={[styles.button, styles[size], styles[variant], className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.icon}>{children}</span>
    </button>
  );
}
