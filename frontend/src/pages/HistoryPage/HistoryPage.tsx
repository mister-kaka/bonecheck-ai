import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import styles from "../../styles/HistoryPage.module.css";

export function HistoryPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>История исследований</h1>
          <p className={styles.subtitle}>Просмотр, фильтрация и экспорт результатов обработки</p>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary">Загрузить пакет</Button>
          <Button variant="primary">Экспорт всех в XLSX</Button>
        </div>
      </header>

      <section className={styles.block} aria-label="Фильтры">
        <div className={styles.filters}>
          <Input placeholder="Поиск по UID" disabled aria-label="Поиск по UID" />
          <Select placeholder="Регион" options={[]} disabled aria-label="Регион" />
          <Select placeholder="Статус" options={[]} disabled aria-label="Статус" />
          <Select placeholder="Сортировка" options={[]} disabled aria-label="Сортировка" />
        </div>
      </section>

      <section className={styles.block} aria-label="Таблица исследований">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Дата</th>
                <th>UID</th>
                <th>Регион</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.empty} colSpan={4}>
                  Список исследований появится здесь
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer className={styles.footer} />
    </div>
  );
}