import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./Select.module.css";

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
  onChange,
  id,
  "aria-label": ariaLabel,
}: SelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuBox, setMenuBox] = useState({
    top: undefined as number | undefined,
    bottom: undefined as number | undefined,
    left: 0,
    width: 0,
    maxHeight: 240,
  });

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const shownLabel = selected?.label ?? placeholder ?? "";

  const placeMenu = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, openUp ? spaceAbove : spaceBelow));
    setMenuBox({
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    menu.style.setProperty("--menu-top", menuBox.top == null ? "auto" : `${menuBox.top}px`);
    menu.style.setProperty("--menu-bottom", menuBox.bottom == null ? "auto" : `${menuBox.bottom}px`);
    menu.style.setProperty("--menu-left", `${menuBox.left}px`);
    menu.style.setProperty("--menu-width", `${menuBox.width}px`);
    menu.style.setProperty("--menu-max-height", `${menuBox.maxHeight}px`);
  }, [menuBox, open]);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`[data-select-menu="${listId}"]`)) return;
      setOpen(false);
    };
    const onReflow = () => placeMenu();
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, listId]);

  const emit = (next: string) => {
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as ChangeEvent<HTMLSelectElement>);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    emit(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const openList = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    placeMenu();
    setOpen(true);
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    }
  };

  return (
    <div className={styles.wrapper} ref={rootRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={[
          styles.trigger,
          error ? styles.error : "",
          disabled ? styles.disabled : "",
          open ? styles.open : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
      >
        <span className={selected ? styles.value : styles.placeholder}>{shownLabel}</span>
        <span className={styles.arrow} aria-hidden="true">
          <Icon name="chevron-right" size={14} />
        </span>
      </button>

      {open &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            data-select-menu={listId}
            className={styles.menu}
            role="listbox"
            aria-label={ariaLabel}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-${index}`}
                    tabIndex={-1}
                    aria-selected={isSelected}
                    className={[
                      styles.option,
                      isSelected ? styles.optionSelected : "",
                      isActive ? styles.optionActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    {isSelected && <Icon name="check" size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
