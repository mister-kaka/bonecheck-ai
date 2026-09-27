import { Icon } from "../Icon";
import styles from "../../styles/ChecksList.module.css";

interface ChecksListProps {
  items?: string[];
}

const defaultItems = [
  "Корректность укладки",
  "Ось позвоночника",
  "Посторонние предметы",
  "Область интереса проксимального отдела бедра",
];

export function ChecksList({ items = defaultItems }: ChecksListProps) {
  return (
    <section className={styles.card} aria-labelledby="checks-list-title">
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
        <h3 id="checks-list-title" className={styles.title}>
          Что проверяет BoneCheck AI
        </h3>
      </header>

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item} className={styles.item}>
            <span className={styles.check} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
