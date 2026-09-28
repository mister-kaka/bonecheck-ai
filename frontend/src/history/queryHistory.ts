import { splitViolationTypes } from "../api/mapStudyResult";
import { VIOLATION_FILTER_VALUES, type ViolationFilterValue } from "../api/layoutCriteria";
import type { StudyListItem, StudyResultPayload } from "../types/study";

export const PAGE_SIZES = [5, 10, 20] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export type HistoryScope = "mine" | "all";
export type OutcomeFilter = "all" | "quality" | "violation" | "processing" | "error";
export type ViolationFilter = "all" | ViolationFilterValue;
export type HistorySort = "date_desc" | "date_asc";

export type HistoryQuery = {
  scope: HistoryScope;
  search: string;
  region: string;
  outcome: OutcomeFilter;
  violation: ViolationFilter;
  dateFrom: string;
  dateTo: string;
  sort: HistorySort;
  page: number;
  pageSize: PageSize;
};

export type HistoryRecord = {
  study: StudyListItem;
  result: StudyResultPayload | null;
};

const REGIONS = new Set([
  "Поясничный отдел позвоночника",
  "Проксимальный отдел бедра",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | null): string {
  if (!value || !ISO_DATE.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return value;
}

function localDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const OUTCOMES = new Set<OutcomeFilter>([
  "all",
  "quality",
  "violation",
  "processing",
  "error",
]);

const VIOLATION_FILTERS = new Set<string>(VIOLATION_FILTER_VALUES);

export function readHistoryQuery(params: URLSearchParams): HistoryQuery {
  const regionRaw = params.get("region") ?? "all";
  const outcomeRaw = params.get("outcome") ?? "all";
  const violationRaw = params.get("violation") ?? "all";
  const pageRaw = Number(params.get("page"));
  const sizeRaw = Number(params.get("size"));

  return {
    scope: params.get("scope") === "all" ? "all" : "mine",
    search: params.get("q") ?? "",
    region: regionRaw === "all" || REGIONS.has(regionRaw) ? regionRaw : "all",
    outcome: OUTCOMES.has(outcomeRaw as OutcomeFilter)
      ? (outcomeRaw as OutcomeFilter)
      : "all",
    violation: VIOLATION_FILTERS.has(violationRaw)
      ? (violationRaw as ViolationFilter)
      : "all",
    dateFrom: parseDateParam(params.get("from")),
    dateTo: parseDateParam(params.get("to")),
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
  if (query.violation !== "all") next.set("violation", query.violation);
  if (query.dateFrom) next.set("from", query.dateFrom);
  if (query.dateTo) next.set("to", query.dateTo);
  if (query.sort !== "date_desc") next.set("sort", query.sort);
  if (query.page > 1) next.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) next.set("size", String(query.pageSize));
  return next;
}

export function hasNarrowingFilters(query: HistoryQuery): boolean {
  return (
    query.search.trim().length > 0 ||
    query.region !== "all" ||
    query.outcome !== "all" ||
    query.violation !== "all" ||
    query.dateFrom.length > 0 ||
    query.dateTo.length > 0
  );
}

export function hasActiveQuery(query: HistoryQuery): boolean {
  return hasNarrowingFilters(query) || query.sort !== "date_desc";
}

function compareStudies(a: HistoryRecord, b: HistoryRecord, sort: HistorySort): number {
  const byDate = Date.parse(a.study.createdAt) - Date.parse(b.study.createdAt);
  const byId = a.study.id < b.study.id ? -1 : a.study.id > b.study.id ? 1 : 0;
  if (sort === "date_asc") return byDate || byId;
  return -byDate || -byId;
}

export function applyHistoryFilters(
  items: HistoryRecord[],
  query: Pick<
    HistoryQuery,
    "search" | "region" | "outcome" | "violation" | "dateFrom" | "dateTo" | "sort"
  >,
): HistoryRecord[] {
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

    if (query.dateFrom || query.dateTo) {
      const day = localDayKey(item.study.createdAt);
      if (!day) return false;
      if (query.dateFrom && day < query.dateFrom) return false;
      if (query.dateTo && day > query.dateTo) return false;
    }

    if (query.violation !== "all") {
      const parts = splitViolationTypes(item.result?.violation_type ?? "");
      if (!parts.includes(query.violation)) return false;
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
