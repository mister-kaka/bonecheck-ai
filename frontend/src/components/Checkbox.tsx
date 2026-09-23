import { InputHTMLAttributes, ReactNode, useId } from "react";
import styles from "../styles/Checkbox.module.css";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

export function Checkbox({
  label,
  disabled = false,
  className,
  id,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <label
      htmlFor={fieldId}
      className={[styles.wrapper, disabled ? styles.disabled : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        {...rest}
        id={fieldId}
        type="checkbox"
        className={styles.input}
        disabled={disabled}
      />
      <span className={styles.box} aria-hidden="true">
        <svg className={styles.check} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6L5 9L10 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  );
}
