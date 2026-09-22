import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

type IconButtonSize = 'sm' | 'md';
type IconButtonVariant = 'ghost' | 'outline';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** Обязательный aria-label для доступности */
  ariaLabel: string;
}

export function IconButton({
  children,
  size = 'md',
  variant = 'ghost',
  ariaLabel,
  disabled = false,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={[
        styles.button,
        styles[size],
        styles[variant],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <span className={styles.icon}>{children}</span>
    </button>
  );
}