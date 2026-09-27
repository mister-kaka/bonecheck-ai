import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HistoryFilters } from "../../components/HistoryPage/HistoryFilters";
import { HistoryTable } from "../../components/HistoryPage/HistoryTable";
import { Icon } from "../../components/Icon";
import { Select } from "../../components/Select";
import { getOrCreateSessionId } from "../../api/session";
import {
  applyHistoryFilters,
  hasActiveQuery,
  hasNarrowingFilters,
  readHistoryQuery,
  studiesInScope,
  toSearchParams,
  type HistoryQuery,
} from "../../history/queryHistory";
import { buildDemoStudies, type DemoStudy } from "../../mocks/history";
import {
  outcomeFilterOptions,
  pageSizeOptions,
  regionFilterOptions,
  sortOptions,
} from "../../mocks/regions";
import tabStyles from "../../styles/Tabs.module.css";
import styles from "../../styles/HistoryPage.module.css";

const DEMO_LOAD_MS = 300;

export function HistoryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = readHistoryQuery(params);
  const sessionId = getOrCreateSessionId();
  const [catalog, setCatalog] = useState<DemoStudy[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setCatalog(buildDemoStudies(sessionId));
    }, DEMO_LOAD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId]);

  const patch = (partial: Partial<HistoryQuery>, resetPage = false) => {
    const next: HistoryQuery = {
      ...query,
      ...partial,
      page: resetPage ? 1 : (partial.page ?? query.page),
    };
    setParams(toSearchParams(next), { replace: true });
  };

  const scoped = useMemo(
    () => (catalog ? studiesInScope(catalog, query.scope, sessionId) : []),
    [catalog, query.scope, sessionId],
  );

  const filtered = useMemo(
    () => (catalog ? applyHistoryFilters(scoped, query) : []),
    [catalog, scoped, query],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const currentPage = Math.min(query.page, totalPages);

  useEffect(() => {
    if (!catalog) return;
    if (query.page > totalPages) {
      patch({ page: totalPages });
    }
  }, [catalog, query.page, totalPages]);

  const start = (currentPage - 1) * query.pageSize;
  const pageItems = filtered.slice(start, start + query.pageSize);
  const loading = catalog === null;
  const narrowing = hasNarrowingFilters(query);
  const scopeEmpty = !loading && scoped.length === 0 && !narrowing;

  const chips = [
    query.region !== "all"
      ? {
          id: "region",
          label: regionFilterOptions.find((option) => option.value === query.region)?.label
            ?? query.region,
        }
      : null,
    query.outcome !== "all"
      ? {
          id: "outcome",
          label: outcomeFilterOptions.find((option) => option.value === query.outcome)?.label
            ?? query.outcome,
        }
      : null,
  ].filter((chip): chip is { id: string; label: string } => chip !== null);

  const resetFilters = () => {
    patch({
      search: "",
      region: "all",
      outcome: "all",
      sort: "date_desc",
    }, true);
  };

  const openStudy = (item: DemoStudy) => {
    navigate({
      pathname: `/history/${item.study.id}`,
      search: params.toString(),
    });
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    patch({ page });
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className={styles.page} data-history-state={loading ? "loading" : "ready"}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.kicker}>Журнал</p>
          <h1 className={styles.title}>История исследований</h1>
          <p className={styles.subtitle}>
            Мои - исследования этой сессии браузера. Все - общая история.
            Сейчас показаны демонстрационные записи, сервер не запрашивался.
          </p>
        </div>
        <div className={styles.headerAside}>
          <div className={tabStyles.tabs} role="tablist" aria-label="Раздел истории">
            <button
              type="button"
              role="tab"
              data-scope="mine"
              aria-selected={query.scope === "mine"}
              className={query.scope === "mine" ? `${tabStyles.tab} ${tabStyles.active}` : tabStyles.tab}
              onClick={() => patch({ scope: "mine" }, true)}
            >
              Мои
            </button>
            <button
              type="button"
              role="tab"
              data-scope="all"
              aria-selected={query.scope === "all"}
              className={query.scope === "all" ? `${tabStyles.tab} ${tabStyles.active}` : tabStyles.tab}
              onClick={() => patch({ scope: "all" }, true)}
            >
              Все
            </button>
          </div>
        </div>
      </header>

      <section className={styles.worklist} aria-label="Список исследований" aria-busy={loading}>
        <HistoryFilters
          search={query.search}
          onSearchChange={(value) => patch({ search: value }, true)}
          onClearSearch={() => patch({ search: "" }, true)}
          region={query.region}
          onRegionChange={(value) => patch({ region: value }, true)}
          regionOptions={regionFilterOptions}
          status={query.outcome}
          onStatusChange={(value) => patch({ outcome: value as HistoryQuery["outcome"] }, true)}
          statusOptions={outcomeFilterOptions}
          sort={query.sort}
          onSortChange={(value) => patch({ sort: value as HistoryQuery["sort"] }, true)}
          sortOptions={sortOptions}
          chips={chips}
          onClearChip={(id) => {
            if (id === "region") patch({ region: "all" }, true);
            if (id === "outcome") patch({ outcome: "all" }, true);
          }}
          onResetAll={hasActiveQuery(query) ? resetFilters : undefined}
          disabled={loading}
        />
        <HistoryTable
          items={pageItems}
          loading={loading}
          emptyTitle="Нет исследований"
          emptySubtitle={
            scopeEmpty
              ? query.scope === "mine"
                ? "В вашей сессии пока нет исследований."
                : "Общая история пуста."
              : "По выбранным фильтрам ничего не найдено"
          }
          emptyActionLabel={narrowing || query.sort !== "date_desc" ? "Сбросить фильтры" : undefined}
          onEmptyAction={narrowing || query.sort !== "date_desc" ? resetFilters : undefined}
          onRowClick={openStudy}
        />
      </section>

      <footer className={styles.footer}>
        <div className={styles.counter}>
          {loading
            ? "Загрузка списка"
            : `Показано ${pageItems.length} из ${filtered.length} · страница ${currentPage} из ${totalPages}`}
        </div>

        <div className={styles.footerControls}>
          <label className={styles.pageSize}>
            На странице
            <span className={styles.pageSizeControl}>
              <Select
                aria-label="Размер страницы"
                options={pageSizeOptions}
                value={String(query.pageSize)}
                disabled={loading}
                onChange={(event) => patch({ pageSize: Number(event.target.value) as HistoryQuery["pageSize"] }, true)}
              />
            </span>
          </label>

          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => goToPage(currentPage - 1)}
              disabled={loading || currentPage === 1}
              aria-label="Предыдущая страница"
            >
              <Icon name="chevron-left" size={16} />
            </button>

            {pageNumbers.map((page) => {
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  type="button"
                  className={`${styles.pageBtn} ${isActive ? styles.pageBtnActive : ""}`}
                  onClick={() => goToPage(page)}
                  disabled={loading}
                  aria-current={isActive ? "page" : undefined}
                >
                  {page}
                </button>
              );
            })}

            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => goToPage(currentPage + 1)}
              disabled={loading || currentPage === totalPages}
              aria-label="Следующая страница"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
