import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { HistoryFilters } from '../../components/HistoryFilters';
import { HistoryTable } from '../../components/HistoryTable';
import { mockHistory } from '../../mocks/history';
import { mockRegions, mockStatuses, mockSorts } from '../../mocks/regions';
import type { HistoryItem } from '../../types/study';
import styles from '../../styles/HistoryPage.module.css';

const PAGE_SIZE = 5;

export function HistoryPage() {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('date_desc');
  const [page, setPage] = useState(1);

  const handleResetFilters = () => {
    setSearch('');
    setRegion('all');
    setStatus('all');
    setSort('date_desc');
    setPage(1);
  };

  const handleRowClick = (item: HistoryItem) => {
    void item;
    // TODO: перейти к деталям исследования
  };

  const handleClearHistory = () => {
    const confirmed = window.confirm(
      'Вы действительно хотите очистить всю историю исследований? Действие необратимо.'
    );
    if (!confirmed) return;
    // TODO: вызов API очистки истории
  };

  const filtered = useMemo(() => {
    let result = [...mockHistory];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((item) => item.uid.toLowerCase().includes(q));
    }

    if (region !== 'all') {
      result = result.filter((item) => item.region === region);
    }

    if (status !== 'all') {
      result = result.filter((item) => {
        if (status === 'quality') return item.status === 'Success' && item.quality_class === 0;
        if (status === 'violation') return item.status === 'Success' && item.quality_class === 1;
        if (status === 'error') return item.status === 'Failure';
        return true;
      });
    }

    result.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return sort === 'date_asc' ? ta - tb : tb - ta;
    });

    return result;
  }, [search, region, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
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
          <Button variant="secondary">Загрузить пакет</Button>
          <Button variant="primary">Экспорт всех в XLSX</Button>
        </div>
      </header>

      <section className={styles.block} aria-label="Фильтры">
        <HistoryFilters
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          region={region}
          onRegionChange={(v) => { setRegion(v); setPage(1); }}
          regionOptions={mockRegions}
          status={status}
          onStatusChange={(v) => { setStatus(v); setPage(1); }}
          statusOptions={mockStatuses}
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          sortOptions={mockSorts}
        />
      </section>

      <section className={styles.block} aria-label="Таблица исследований">
        <HistoryTable
          items={pageItems}
          onRowClick={handleRowClick}
          onResetFilters={handleResetFilters}
        />
      </section>

      <footer className={styles.footer}>
        <div className={styles.counter}>
          Показано {pageItems.length} из {filtered.length} исследований
        </div>

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Предыдущая страница"
          >
            ‹
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                className={`${styles.pageBtn} ${isActive ? styles.pageBtnActive : ''}`}
                onClick={() => goToPage(p)}
                aria-current={isActive ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Следующая страница"
          >
            ›
          </button>
        </div>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClearHistory}
        >
          Очистить историю
        </button>
      </footer>
    </div>
  );
}