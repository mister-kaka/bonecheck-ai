import { Badge, type BadgeTone } from "../ui/Badge";
import type { StudyStatus } from "../../types/study";

const STATUS_VIEW: Record<StudyStatus, { label: string; tone: BadgeTone }> = {
  uploaded: { label: "Файл принят", tone: "muted" },
  processing: { label: "Идёт анализ", tone: "info" },
  completed: { label: "Готово", tone: "success" },
  error: { label: "Ошибка анализа", tone: "danger" },
};

export function statusLabel(status: StudyStatus): string {
  return STATUS_VIEW[status].label;
}

export function StatusBadge({ status }: { status: StudyStatus }) {
  const view = STATUS_VIEW[status];
  return <Badge tone={view.tone}>{view.label}</Badge>;
}
