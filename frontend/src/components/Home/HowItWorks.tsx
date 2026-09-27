import { Icon } from "../Icon";
import styles from "../../styles/HowItWorks.module.css";

export interface HowItWorksStep {
  title: string;
  caption: string;
}

interface HowItWorksProps {
  steps?: HowItWorksStep[];
}

const defaultSteps: HowItWorksStep[] = [
  { title: "Загрузите исследование", caption: "Один файл DICOM (.dcm или .dicom)" },
  { title: "Дождитесь анализа", caption: "Сервис проверит качество укладки" },
  { title: "Получите результат", caption: "Класс качества, нарушения и просмотр снимка" },
];

export function HowItWorks({ steps = defaultSteps }: HowItWorksProps) {
  return (
    <section className={styles.card} aria-labelledby="how-it-works-title">
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <Icon name="info" size={16} />
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
