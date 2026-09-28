import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useXlsxDownload } from "../../api/useXlsxDownload";
import { PageIntro } from "../../components/layout/PageIntro";
import { Button } from "../../components/ui/Button";
import { HistoryFilters } from "../../components/HistoryPage/HistoryFilters";
import { HistoryTable } from "../../components/HistoryPage/HistoryTable";
import { Icon } from "../../components/ui/Icon";
import { Select } from "../../components/ui/Select";
import {
  historyFilterChips,
  outcomeFilterOptions,
  pageSizeOptions,
  violationFilterOptions,
  regionFilterOptions,
  sortOptions,
} from "../../history/filterOptions";
import {
  applyHistoryFilters,
  hasActiveQuery,
  hasNarrowingFilters,
  readHistoryQuery,
  toSearchParams,
  type HistoryQuery,
  type HistoryRecord,
} from "../../history/queryHistory";
import tabStyles from "../../components/ui/Tabs.module.css";
import styles from "./HistoryPage.module.css";
import { useHistoryCatalog } from "./useHistoryCatalog";

const EMPTY_EXPORT_MESSAGE = "По выбранным фильтрам нет исследований для выгрузки.";

export function HistoryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = readHistoryQuery(params);
  const xlsx = useXlsxDownload();
  const { load, sessionId, reload } = useHistoryCatalog(query.scope);

  const patch = (partial: Partial<HistoryQuery>, resetPage = false) => {
    const next: HistoryQuery = {
      ...query,
      ...partial,
      page: resetPage ? 1 : (partial.page ?? query.page),
    };
    setParams(toSearchParams(next), { replace: true });
  };

  const catalog = load.status === "ready" ? load.items : [];
  const filtered = useMemo(
    () => applyHistoryFilters(catalog, query),
    [catalog, query],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const currentPage = Math.min(query.page, totalPages);
  const loading = load.status === "loading";

  useEffect(() => {
    if (load.status !== "ready") return;
    if (query.page > totalPages) {
      patch({ page: totalPages });
    }
  }, [load.status, query.page, totalPages]);

  const start = (currentPage - 1) * query.pageSize;
  const pageItems = filtered.slice(start, start + query.pageSize);
  const narrowing = hasNarrowingFilters(query);
  const scopeEmpty = load.status === "ready" && catalog.length === 0 && !narrowing;

  const chips = historyFilterChips(query);

  const resetFilters = () => {
    patch({
      search: "",
      region: "all",
      outcome: "all",
      violation: "all",
      dateFrom: "",
      dateTo: "",
      sort: "date_desc",
    }, true);
  };

  const openStudy = (item: HistoryRecord) => {
    navigate({
      pathname: `/history/${item.study.id}`,
      search: params.toString(),
    });
  };

  const exportHistory = () => {
    if (load.status !== "ready") return;
    if (filtered.length === 0) {
      if (narrowing) {
        xlsx.report(EMPTY_EXPORT_MESSAGE);
        return;
      }
      void xlsx.download({
        sessionId: query.scope === "mine" ? sessionId : undefined,
      });
      return;
    }
    void xlsx.download({ ids: filtered.map((item) => item.study.id) });
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    patch({ page });
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className={`${styles.page} ${styles.pageFill}`} data-history-state={loading ? "loading" : load.status}>
      <header className={styles.header}>
        <PageIntro
          kicker="Журнал"
          title="История исследований"
          subtitle="Мои - ваши загрузки. Все - общая история."
        />
        <div className={styles.headerAside}>
          <Button
            variant="secondary"
            size="sm"
            disabled={xlsx.exporting || load.status !== "ready"}
            onClick={exportHistory}
          >
            {xlsx.exporting ? "Выгрузка..." : "Экспорт XLSX"}
          </Button>
          {xlsx.exportError && (
            <p className={styles.exportError} role="alert">
              {xlsx.exportError}
            </p>
          )}
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

      <section className={`${styles.worklist} ${styles.worklistFill}`} aria-label="Список исследований" aria-busy={loading}>
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
          violation={query.violation}
          onViolationChange={(value) => patch({ violation: value as HistoryQuery["violation"] }, true)}
          violationOptions={violationFilterOptions}
          dateFrom={query.dateFrom}
          dateTo={query.dateTo}
          onDateFromChange={(value) => patch({ dateFrom: value }, true)}
          onDateToChange={(value) => patch({ dateTo: value }, true)}
          sort={query.sort}
          onSortChange={(value) => patch({ sort: value as HistoryQuery["sort"] }, true)}
          sortOptions={sortOptions}
          chips={chips}
          onClearChip={(id) => {
            if (id === "region") patch({ region: "all" }, true);
            if (id === "outcome") patch({ outcome: "all" }, true);
            if (id === "violation") patch({ violation: "all" }, true);
            if (id === "dateFrom") patch({ dateFrom: "" }, true);
            if (id === "dateTo") patch({ dateTo: "" }, true);
          }}
          onResetAll={hasActiveQuery(query) ? resetFilters : undefined}
          disabled={loading}
        />
        {load.status === "error" ? (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Не удалось загрузить историю</h2>
            <p className={styles.panelText}>{load.message}</p>
            <Button variant="secondary" size="sm" onClick={reload}>
              Повторить
            </Button>
          </div>
        ) : (
          <HistoryTable
            items={pageItems}
            loading={loading}
            emptyTitle="Нет исследований"
            emptySubtitle={
              scopeEmpty
                ? query.scope === "mine"
                  ? "Вы ещё не загружали исследования."
                  : "Общая история пуста."
                : "По выбранным фильтрам ничего не найдено"
            }
            emptyActionLabel={narrowing || query.sort !== "date_desc" ? "Сбросить фильтры" : undefined}
            onEmptyAction={narrowing || query.sort !== "date_desc" ? resetFilters : undefined}
            onRowClick={openStudy}
          />
        )}
      </section>

      <footer className={styles.footer}>
        <div className={styles.counter}>
          {loading
            ? "Загрузка списка"
            : load.status === "error"
              ? "Список недоступен"
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
