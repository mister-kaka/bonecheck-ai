import { InputHTMLAttributes, ReactNode } from "react";
import styles from "../styles/Input.module.css";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  icon?: ReactNode;
  error?: boolean;
  errorText?: string;
}

export function Input({
  icon,
  error = false,
  errorText,
  disabled = false,
  className,
  ...rest
}: InputProps) {
  return (
    <div className={styles.wrapper}>
      <div
        className={[
          styles.inputContainer,
          error ? styles.error : "",
          disabled ? styles.disabled : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <input {...rest} className={styles.input} disabled={disabled} />
      </div>
      {error && errorText && <span className={styles.errorText}>{errorText}</span>}
    </div>
  );
}
