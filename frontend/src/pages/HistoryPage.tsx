import { Button } from '../components/Button';
import styles from './HistoryPage.module.css';

export function HistoryPage() {
  const handleUpload = () => {
    // TODO: обработка загрузки пакета
  };

  const handleExport = () => {
    // TODO: обработка экспорта в XLSX
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>История исследований</h1>
          <p className={styles.subtitle}>
            Просмотр, фильтрация и экспорт результатов обработки
          </p>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleUpload}>
            Загрузить пакет
          </Button>
          <Button variant="primary" onClick={handleExport}>
            Экспорт всех в XLSX
          </Button>
        </div>
      </header>

      <section className={styles.block} aria-label="Фильтры">
        {/* TODO: HistoryFilters */}
      </section>

      <section className={styles.block} aria-label="Таблица исследований">
        {/* TODO: HistoryTable */}
      </section>

      <footer className={styles.footer}>
        {/* TODO: пагинация / счётчик */}
      </footer>
    </div>
  );
}