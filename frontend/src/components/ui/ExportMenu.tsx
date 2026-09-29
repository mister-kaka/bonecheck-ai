import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button";
import styles from "./ExportMenu.module.css";

interface ExportMenuProps {
  disabled?: boolean;
  busy?: boolean;
  size?: "sm" | "md";
  align?: "start" | "end";
  placement?: "below" | "above";
  onJournal: () => void;
  onSubmission: () => void;
}

export function ExportMenu({
  disabled = false,
  busy = false,
  size = "md",
  align = "start",
  placement = "below",
  onJournal,
  onSubmission,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (busy) setOpen(false);
  }, [busy]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div
      className={[
        styles.root,
        align === "end" ? styles.alignEnd : "",
        placement === "above" ? styles.above : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={rootRef}
    >
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={disabled || busy}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? "Экспорт..." : "Экспорт"}
      </Button>
      {open && (
        <div className={styles.menu} id={menuId} role="menu" aria-label="Что экспортировать">
          <button
            type="button"
            className={styles.option}
            role="menuitem"
            onClick={() => choose(onJournal)}
          >
            <span className={styles.optionTitle}>Журнал</span>
            <span className={styles.optionText}>
              Дата, область и результат словами.
            </span>
          </button>
          <button
            type="button"
            className={styles.option}
            role="menuitem"
            onClick={() => choose(onSubmission)}
          >
            <span className={styles.optionTitle}>Итоговый файл</span>
            <span className={styles.optionText}>
              Класс качества, нарушения и время обработки по каждому снимку.
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
