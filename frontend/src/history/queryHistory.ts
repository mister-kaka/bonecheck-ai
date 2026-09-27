import type { DemoStudy } from "../mocks/history";

export const PAGE_SIZES = [5, 10, 20] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export type HistoryScope = "mine" | "all";
export type OutcomeFilter = "all" | "quality" | "violation" | "processing" | "error";
export type HistorySort = "date_desc" | "date_asc";

export type HistoryQuery = {
  scope: HistoryScope;
  search: string;
  region: string;
  outcome: OutcomeFilter;
  sort: HistorySort;
  page: number;
  pageSize: PageSize;
};

const REGIONS = new Set([
  "Поясничный отдел позвоночника",
  "Проксимальный отдел бедра",
]);

const OUTCOMES = new Set<OutcomeFilter>([
  "all",
  "quality",
  "violation",
  "processing",
  "error",
]);

export function readHistoryQuery(params: URLSearchParams): HistoryQuery {
  const regionRaw = params.get("region") ?? "all";
  const outcomeRaw = params.get("outcome") ?? "all";
  const pageRaw = Number(params.get("page"));
  const sizeRaw = Number(params.get("size"));

  return {
    scope: params.get("scope") === "all" ? "all" : "mine",
    search: params.get("q") ?? "",
    region: regionRaw === "all" || REGIONS.has(regionRaw) ? regionRaw : "all",
    outcome: OUTCOMES.has(outcomeRaw as OutcomeFilter)
      ? (outcomeRaw as OutcomeFilter)
      : "all",
    sort: params.get("sort") === "date_asc" ? "date_asc" : "date_desc",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(sizeRaw)
      ? (sizeRaw as PageSize)
      : DEFAULT_PAGE_SIZE,
  };
}

export function toSearchParams(query: HistoryQuery): URLSearchParams {
  const next = new URLSearchParams();
  if (query.scope === "all") next.set("scope", "all");
  if (query.search.length > 0) next.set("q", query.search);
  if (query.region !== "all") next.set("region", query.region);
  if (query.outcome !== "all") next.set("outcome", query.outcome);
  if (query.sort !== "date_desc") next.set("sort", query.sort);
  if (query.page > 1) next.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) next.set("size", String(query.pageSize));
  return next;
}

export function hasNarrowingFilters(query: HistoryQuery): boolean {
  return (
    query.search.trim().length > 0 ||
    query.region !== "all" ||
    query.outcome !== "all"
  );
}

export function hasActiveQuery(query: HistoryQuery): boolean {
  return hasNarrowingFilters(query) || query.sort !== "date_desc";
}

export function studiesInScope(
  items: DemoStudy[],
  scope: HistoryScope,
  sessionId: string,
): DemoStudy[] {
  if (scope === "all") return items;
  return items.filter((item) => item.study.sessionId === sessionId);
}

function compareStudies(a: DemoStudy, b: DemoStudy, sort: HistorySort): number {
  const byDate = Date.parse(a.study.createdAt) - Date.parse(b.study.createdAt);
  const byId = a.study.id < b.study.id ? -1 : a.study.id > b.study.id ? 1 : 0;
  if (sort === "date_asc") return byDate || byId;
  return -byDate || -byId;
}

export function applyHistoryFilters(
  items: DemoStudy[],
  query: Pick<HistoryQuery, "search" | "region" | "outcome" | "sort">,
): DemoStudy[] {
  const needle = query.search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (needle) {
      const name = item.study.originalFileName.toLowerCase();
      const id = item.study.id.toLowerCase();
      if (!name.includes(needle) && !id.includes(needle)) return false;
    }

    if (query.region !== "all" && item.result?.anatomical_region !== query.region) {
      return false;
    }

    if (query.outcome === "quality") {
      return item.study.status === "completed" && item.result?.quality_class === 0;
    }
    if (query.outcome === "violation") {
      return item.study.status === "completed" && item.result?.quality_class === 1;
    }
    if (query.outcome === "processing") return item.study.status === "processing";
    if (query.outcome === "error") return item.study.status === "error";
    return true;
  });

  return filtered.sort((a, b) => compareStudies(a, b, query.sort));
}
