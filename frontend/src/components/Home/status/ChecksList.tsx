import { SPINE_CRITERIA } from "../../../api/layoutCriteria";
import styles from "./ChecksList.module.css";

export function ChecksList() {
  return (
    <section className={styles.card} aria-labelledby="checks-list-title">
      <h3 id="checks-list-title" className={styles.title}>
        Типы нарушений
      </h3>

      <ul className={styles.list}>
        {SPINE_CRITERIA.map((item) => (
          <li key={item} className={styles.item}>
            <span className={styles.check} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
