import styles from "./PageIntro.module.css";

type PageIntroProps = {
  kicker: string;
  title: string;
  subtitle: string;
};

export function PageIntro({ kicker, title, subtitle }: PageIntroProps) {
  return (
    <div className={styles.intro}>
      <p className={styles.kicker}>{kicker}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  );
}
