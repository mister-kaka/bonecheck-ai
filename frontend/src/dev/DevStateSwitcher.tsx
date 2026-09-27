import type { DemoMode } from "./homePreview";
import styles from "./DevStateSwitcher.module.css";

const OPTIONS: Array<{ id: DemoMode; label: string }> = [
  { id: "live", label: "Сценарий загрузки" },
  { id: "idle", label: "Пустой экран" },
  { id: "selected", label: "Файл выбран" },
  { id: "uploading", label: "Загрузка" },
  { id: "validation-empty", label: "Ошибка: пустой файл" },
  { id: "validation-type", label: "Ошибка: формат" },
  { id: "validation-size", label: "Ошибка: размер" },
  { id: "processing", label: "Анализ" },
  { id: "result-ok", label: "Результат без нарушения" },
  { id: "result-violation", label: "Нарушение: позвоночник" },
  { id: "result-hip", label: "Нарушение: бедро" },
  { id: "result-no-prob", label: "Результат без вероятности" },
  { id: "analysis-error", label: "Ошибка анализа" },
];

interface DevStateSwitcherProps {
  value: DemoMode;
  onChange: (mode: DemoMode) => void;
}

/** Временный переключатель состояний. Удалить src/dev, когда главная пойдёт в API. */
export function DevStateSwitcher({ value, onChange }: DevStateSwitcherProps) {
  return (
    <aside className={styles.switcher} data-dev-state-switcher="true">
      <span className={styles.mark}>Демо</span>
      <label className={styles.label}>
        Состояние экрана
        <select
          className={styles.select}
          aria-label="Демонстрационное состояние, не часть продукта"
          value={value}
          onChange={(event) => onChange(event.target.value as DemoMode)}
        >
          {OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}
