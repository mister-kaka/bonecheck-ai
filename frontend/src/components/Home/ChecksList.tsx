import styles from "../../styles/ChecksList.module.css";

interface ChecksListProps {
  /** Список проверок; по умолчанию — три категории из макета */
  items?: string[];
}

const defaultItems = [
  "Корректность укладки",
  "Ось позвоночника",
  "Посторонние предметы и артефакты",
];

export function ChecksList({ items = defaultItems }: ChecksListProps) {
  return (
    <section className={styles.card} aria-labelledby="checks-list-title">
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <img src="/icons/check-circle.png" alt="" width={18} height={18} />
        </span>
        <h3 id="checks-list-title" className={styles.title}>
          Что проверяет BoneCheck AI
        </h3>
      </header>

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item} className={styles.item}>
            <span className={styles.check} aria-hidden="true">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
