import { SelectHTMLAttributes } from "react";
import styles from "../styles/Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}

export function Select({
  options,
  placeholder,
  error = false,
  disabled = false,
  className,
  value,
  ...rest
}: SelectProps) {
  return (
    <div className={styles.wrapper}>
      <div
        className={[
          styles.selectContainer,
          error ? styles.error : "",
          disabled ? styles.disabled : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <select {...rest} className={styles.select} disabled={disabled} value={value}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.arrow} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
