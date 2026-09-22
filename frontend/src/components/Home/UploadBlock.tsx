import { Button } from "../Button";
import styles from "./UploadBlock.module.css";

export function UploadBlock() {
  return (
    <section className={styles.uploadBlock}>
      <div className={styles.dropZone}>
        <span className={styles.icon} aria-hidden="true">
          ⬆
        </span>

        <h2 className={styles.title}>Загрузите DICOM-исследование</h2>
        <p className={styles.subtitle}>Перетащите файл или папку сюда</p>

        <div className={styles.actions}>
          <Button variant="secondary">Выбрать файл</Button>
          <Button variant="primary">Загрузить ZIP</Button>
        </div>

        <p className={styles.formats}>Поддерживаемые форматы: .dcm, .zip</p>
      </div>

      <p className={styles.hint}>
        Подсказка: можно загрузить один .dcm-файл или ZIP-архив со всеми снимками
        исследования.
      </p>
    </section>
  );
}
