import { Icon, type IconName } from "../Icon";
import styles from "../../styles/ProcessStatus.module.css";

export type ProcessStage = "idle" | "uploading" | "processing";

export type StepState = "done" | "active" | "next" | "waiting" | "unavailable";

export interface ProcessStep {
  label: string;
  state: StepState;
}

interface ProcessStatusProps {
  stage?: ProcessStage;
  steps?: ProcessStep[];
}

const LABELS = ["Загрузка файла", "Подготовка данных", "Анализ", "Результат"];

const STAGE_STATES: Record<ProcessStage, StepState[]> = {
  idle: ["waiting", "waiting", "waiting", "unavailable"],
  uploading: ["active", "waiting", "waiting", "waiting"],
  processing: ["done", "done", "active", "waiting"],
};

const STATUS_TEXT: Record<StepState, string> = {
  done: "Готово",
  active: "В процессе",
  next: "Ожидание",
  waiting: "Ожидание",
  unavailable: "Недоступен",
};

const STEP_ICON: Record<StepState, IconName | null> = {
  done: "check",
  active: null,
  next: null,
  waiting: null,
  unavailable: null,
};

export function ProcessStatus({ stage = "idle", steps }: ProcessStatusProps) {
  const items: ProcessStep[] =
    steps ?? LABELS.map((label, i) => ({ label, state: STAGE_STATES[stage][i] }));

  return (
    <aside className={styles.card} aria-labelledby="process-status-title" aria-live="polite">
      <h3 id="process-status-title" className={styles.title}>
        Ход проверки
      </h3>

      <ol className={styles.steps}>
        {items.map((step) => {
          const icon = STEP_ICON[step.state];
          return (
            <li
              key={step.label}
              className={`${styles.step} ${styles[step.state]}`}
              aria-current={step.state === "active" ? "step" : undefined}
            >
              <span className={styles.icon} aria-hidden="true">
                {icon ? <Icon name={icon} size={12} /> : null}
              </span>
              <div className={styles.text}>
                <p className={styles.label}>{step.label}</p>
                <p className={styles.status}>{STATUS_TEXT[step.state]}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
