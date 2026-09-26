import styles from "../../styles/HowItWorks.module.css";

export interface HowItWorksStep {
  title: string;
  caption: string;
}

interface HowItWorksProps {
  /** Шаги можно переопределить, по умолчанию — три шага из макета */
  steps?: HowItWorksStep[];
}

const defaultSteps: HowItWorksStep[] = [
  { title: "Загрузите исследование", caption: "DICOM-файл или ZIP-архив" },
  { title: "Дождитесь анализа", caption: "Система проверит качество укладки и снимков" },
  { title: "Получите результат", caption: "С подробной информацией и визуализацией" },
];

export function HowItWorks({ steps = defaultSteps }: HowItWorksProps) {
  return (
    <section className={styles.card} aria-labelledby="how-it-works-title">
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <img src="/icons/info.png" alt="" width={18} height={18} />
        </span>
        <h3 id="how-it-works-title" className={styles.title}>
          Как это работает
        </h3>
      </header>

      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number}>{String(i + 1).padStart(2, "0")}</span>
            <p className={styles.stepTitle}>{step.title}</p>
            <p className={styles.caption}>{step.caption}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
